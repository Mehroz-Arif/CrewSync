import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";

/** Check if the current user is a super admin */
export const isSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    return user?.isSuperAdmin === true;
  },
});

/** List all organizations with member counts */
export const listOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || !user.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Super admin access required" });
    }

    const organizations = await ctx.db.query("organizations").collect();
    const allUsers = await ctx.db.query("users").collect();

    return organizations.map((org) => {
      const members = allUsers.filter((u) => u.organizationId === org._id);
      const admins = members.filter((u) => u.role === "admin");
      return {
        ...org,
        memberCount: members.length,
        adminCount: admins.length,
        adminNames: admins.map((a) => a.name ?? "Unnamed").join(", "),
      };
    });
  },
});

/** Get details for a specific organization */
export const getOrganizationDetails = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || !user.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Super admin access required" });
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
    }

    const allUsers = await ctx.db.query("users").collect();
    const members = allUsers.filter((u) => u.organizationId === args.organizationId);

    const invites = await ctx.db
      .query("invites")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    const pendingInvites = invites.filter((i) => i.status === "pending");

    return {
      ...org,
      members,
      pendingInvites,
    };
  },
});

/** Create a new organization (super admin only) */
export const createOrganization = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    adminEmail: v.optional(v.string()),
    adminName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const superAdmin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!superAdmin || !superAdmin.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Super admin access required" });
    }

    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      description: args.description,
      createdBy: superAdmin._id,
      status: "active",
    });

    // If an admin email is provided, try to assign or invite them
    if (args.adminEmail) {
      const normalizedEmail = args.adminEmail.toLowerCase();
      const allUsers = await ctx.db.query("users").collect();
      const existingUser = allUsers.find((u) => u.email?.toLowerCase() === normalizedEmail);

      if (existingUser) {
        if (existingUser.organizationId) {
          throw new ConvexError({
            code: "CONFLICT",
            message: `${existingUser.name ?? existingUser.email} already belongs to another organization`,
          });
        }
        await ctx.db.patch(existingUser._id, {
          organizationId: orgId,
          role: "admin",
        });
      } else {
        // Create an invite for the admin
        await ctx.db.insert("invites", {
          organizationId: orgId,
          email: normalizedEmail,
          name: args.adminName ?? "Admin",
          role: "admin",
          status: "pending",
        });
      }
    }

    return orgId;
  },
});

/** Update an organization (super admin only) */
export const updateOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const superAdmin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!superAdmin || !superAdmin.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Super admin access required" });
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.organizationId, updates);
  },
});

/** Delete an organization and remove all members (super admin only) */
export const deleteOrganization = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const superAdmin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!superAdmin || !superAdmin.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Super admin access required" });
    }

    // Remove all members from the org
    const allUsers = await ctx.db.query("users").collect();
    const orgMembers = allUsers.filter((u) => u.organizationId === args.organizationId);
    for (const member of orgMembers) {
      await ctx.db.patch(member._id, {
        organizationId: undefined,
        role: undefined,
      });
    }

    // Delete pending invites for this org
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    for (const invite of invites) {
      await ctx.db.delete(invite._id);
    }

    // Delete the organization
    await ctx.db.delete(args.organizationId);
  },
});

/** Promote / demote a user to super admin (super admin only) */
export const toggleSuperAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const superAdmin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!superAdmin || !superAdmin.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Super admin access required" });
    }
    if (args.userId === superAdmin._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot change your own super admin status" });
    }
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    await ctx.db.patch(args.userId, { isSuperAdmin: !target.isSuperAdmin });
  },
});

/** List all users platform-wide (super admin only) */
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || !user.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Super admin access required" });
    }

    const allUsers = await ctx.db.query("users").collect();
    const allOrgs = await ctx.db.query("organizations").collect();
    const orgMap = new Map(allOrgs.map((o) => [o._id, o.name]));

    return allUsers.map((u) => ({
      ...u,
      organizationName: u.organizationId ? orgMap.get(u.organizationId) ?? "Unknown" : undefined,
    }));
  },
});

/** Move a user to a different organization (super admin only) */
export const moveUserToOrganization = mutation({
  args: {
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const superAdmin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!superAdmin || !superAdmin.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Super admin access required" });
    }
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    if (args.organizationId) {
      const org = await ctx.db.get(args.organizationId);
      if (!org) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
      }
      await ctx.db.patch(args.userId, {
        organizationId: args.organizationId,
        role: args.role ?? "staff",
      });
    } else {
      // Remove from organization
      await ctx.db.patch(args.userId, {
        organizationId: undefined,
        role: undefined,
      });
    }
  },
});

/** Platform stats for super admin dashboard */
export const getPlatformStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || !user.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Super admin access required" });
    }

    const allUsers = await ctx.db.query("users").collect();
    const allOrgs = await ctx.db.query("organizations").collect();
    const allInvites = await ctx.db.query("invites").collect();

    const usersWithOrg = allUsers.filter((u) => u.organizationId);
    const usersWithoutOrg = allUsers.filter((u) => !u.organizationId);
    const pendingInvites = allInvites.filter((i) => i.status === "pending");
    const superAdmins = allUsers.filter((u) => u.isSuperAdmin);

    return {
      totalUsers: allUsers.length,
      totalOrganizations: allOrgs.length,
      usersInOrgs: usersWithOrg.length,
      unassignedUsers: usersWithoutOrg.length,
      pendingInvites: pendingInvites.length,
      superAdminCount: superAdmins.length,
    };
  },
});
