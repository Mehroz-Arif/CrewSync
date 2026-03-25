import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";

/** Get the current user's organization (with logo URL) */
export const getMyOrganization = query({
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
    if (!user || !user.organizationId) return null;
    const org = await ctx.db.get(user.organizationId);
    if (!org) return null;
    const logoUrl = org.logoStorageId
      ? await ctx.storage.getUrl(org.logoStorageId)
      : null;
    return { ...org, logoUrl };
  },
});

/** Create a new organization (sets creator as admin) */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (user.organizationId && !user.isSuperAdmin) {
      throw new ConvexError({ code: "CONFLICT", message: "You already belong to an organization" });
    }

    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      createdBy: user._id,
    });

    // Set creator as admin of the org
    await ctx.db.patch(user._id, { organizationId: orgId, role: "admin" });
    return orgId;
  },
});

/** Update organization details (admin only) */
export const update = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    if (!user.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "No organization found" });
    }
    await ctx.db.patch(user.organizationId, { name: args.name });
  },
});

/** Get all members in the current user's organization */
export const getMembers = query({
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
    if (!user || !user.organizationId) return [];

    const orgId = user.organizationId;
    // organizationId is optional so we can't index on it; filter in JS instead
    const allUsers = await ctx.db.query("users").collect();
    return allUsers.filter((u) => u.organizationId === orgId);
  },
});

/** Add a member to the organization by email (admin only).
 *  If user already exists → links to org directly.
 *  Otherwise → creates a pending invite. */
export const addMember = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args): Promise<{ type: "added" } | { type: "invited" }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    if (!user.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "No organization found" });
    }

    const orgId = user.organizationId;
    const normalizedEmail = args.email.toLowerCase();

    // Check for existing user with this email
    const allUsers = await ctx.db.query("users").collect();
    const existingUser = allUsers.find((u) => u.email?.toLowerCase() === normalizedEmail);

    if (existingUser) {
      if (existingUser.organizationId === orgId) {
        throw new ConvexError({ code: "CONFLICT", message: "This user is already in your organization" });
      }
      if (existingUser.organizationId) {
        throw new ConvexError({ code: "CONFLICT", message: "This user belongs to another organization" });
      }
      // Add existing user directly to org
      await ctx.db.patch(existingUser._id, {
        organizationId: orgId,
        role: args.role,
        name: args.name || existingUser.name,
      });
      return { type: "added" };
    }

    // Check for existing pending invite
    const existingInvites = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    const hasPending = existingInvites.some(
      (i) => i.status === "pending" && i.organizationId === orgId,
    );
    if (hasPending) {
      throw new ConvexError({ code: "CONFLICT", message: "An invite already exists for this email" });
    }

    // Create a pending invite
    await ctx.db.insert("invites", {
      organizationId: orgId,
      email: normalizedEmail,
      name: args.name,
      role: args.role,
      status: "pending",
    });
    return { type: "invited" };
  },
});

/** Get pending invites for the current user's organization */
export const getInvites = query({
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
    if (!user || !user.organizationId) return [];

    const orgId = user.organizationId;
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    return invites.filter((i) => i.status === "pending");
  },
});

/** Cancel a pending invite (admin only) */
export const cancelInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    await ctx.db.delete(args.inviteId);
  },
});

/** Change a member's role (admin only, cannot change own role) */
export const updateMemberRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    if (args.userId === user._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
    }
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

/** Generate an upload URL for organization logo (admin only) */
export const generateLogoUploadUrl = mutation({
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
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/** Update the organization's logo (admin only) */
export const updateLogo = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    if (!user.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "No organization found" });
    }
    // Delete old logo if exists
    const org = await ctx.db.get(user.organizationId);
    if (org?.logoStorageId) {
      await ctx.storage.delete(org.logoStorageId);
    }
    await ctx.db.patch(user.organizationId, { logoStorageId: args.storageId });
  },
});

/** Remove the organization's logo (admin only) */
export const removeLogo = mutation({
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
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    if (!user.organizationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "No organization found" });
    }
    const org = await ctx.db.get(user.organizationId);
    if (org?.logoStorageId) {
      await ctx.storage.delete(org.logoStorageId);
      await ctx.db.patch(user.organizationId, { logoStorageId: undefined });
    }
  },
});

/** Remove a member from the organization (admin only, cannot remove self) */
export const removeMember = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    if (args.userId === user._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot remove yourself" });
    }
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    // Replace document without organizationId and role to clear org membership
    await ctx.db.replace(args.userId, {
      tokenIdentifier: targetUser.tokenIdentifier,
      name: targetUser.name,
      email: targetUser.email,
      department: targetUser.department,
      avatarUrl: targetUser.avatarUrl,
    });
  },
});
