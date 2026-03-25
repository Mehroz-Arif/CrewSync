import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Get a user's public profile by ID */
export const getProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ code: "NOT_FOUND", message: "Current user not found" });

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const isAdmin = currentUser.role === "admin";
    const isSelf = currentUser._id === target._id;

    // Return full profile for admin or self, limited for others
    return {
      _id: target._id,
      _creationTime: target._creationTime,
      name: target.name,
      email: target.email,
      role: target.role,
      department: target.department,
      avatarUrl: target.avatarUrl,
      phone: target.phone,
      bio: target.bio,
      employmentType: target.employmentType,
      positions: target.positions,
      startDate: target.startDate,
      skills: target.skills,
      certifications: target.certifications,
      // Sensitive fields – only visible to admin or self
      address: isAdmin || isSelf ? target.address : undefined,
      emergencyContactName: isAdmin || isSelf ? target.emergencyContactName : undefined,
      emergencyContactPhone: isAdmin || isSelf ? target.emergencyContactPhone : undefined,
      hourlyRate: isAdmin ? target.hourlyRate : undefined,
      notes: isAdmin ? target.notes : undefined,
      suspended: target.suspended,
      isSuperAdmin: target.isSuperAdmin,
    };
  },
});

/** Update own profile (non-admin fields) */
export const updateMyProfile = mutation({
  args: {
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    certifications: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    await ctx.db.patch(user._id, {
      phone: args.phone,
      bio: args.bio,
      address: args.address,
      emergencyContactName: args.emergencyContactName,
      emergencyContactPhone: args.emergencyContactPhone,
      skills: args.skills,
      certifications: args.certifications,
    });
  },
});

/** Admin: update any user's profile including admin-only fields */
export const updateProfileAsAdmin = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
    department: v.optional(v.string()),
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    employmentType: v.optional(v.union(v.literal("employee"), v.literal("subcontractor"))),
    positions: v.optional(v.array(v.string())),
    startDate: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    certifications: v.optional(v.array(v.string())),
    hourlyRate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (admin.role !== "admin" && !admin.isSuperAdmin) throw new ConvexError({ code: "FORBIDDEN", message: "Admin only" });

    const { userId, ...fields } = args;
    await ctx.db.patch(userId, fields);
  },
});

/** Get all team members for the directory */
export const getDirectory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const all = await ctx.db.query("users").collect();
    return all.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      avatarUrl: u.avatarUrl,
      employmentType: u.employmentType,
      positions: u.positions,
      phone: u.phone,
      skills: u.skills,
      suspended: u.suspended,
    }));
  },
});

/** Admin/Super Admin: suspend or reactivate a user */
export const toggleSuspend = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (admin.role !== "admin" && !admin.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    if (args.userId === admin._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot suspend yourself" });
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    await ctx.db.patch(args.userId, { suspended: !target.suspended });
    return !target.suspended;
  },
});
