import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";

/** List all vehicles ordered by sortOrder */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }

    const vehicles = await ctx.db.query("vehicles").collect();
    return vehicles.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** List only active vehicles (for dropdowns) */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }

    const vehicles = await ctx.db.query("vehicles").collect();
    return vehicles
      .filter((v) => v.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** Create a new vehicle (admin only) */
export const create = mutation({
  args: {
    registration: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can manage vehicles", code: "FORBIDDEN" });
    }

    // Check for duplicate registration
    const existing = await ctx.db
      .query("vehicles")
      .withIndex("by_registration", (q) => q.eq("registration", args.registration))
      .first();
    if (existing) {
      throw new ConvexError({
        message: `Vehicle "${args.registration}" already exists`,
        code: "CONFLICT",
      });
    }

    // Get max sort order
    const all = await ctx.db.query("vehicles").collect();
    const maxOrder = all.reduce((max, v) => Math.max(max, v.sortOrder), 0);

    return await ctx.db.insert("vehicles", {
      registration: args.registration,
      label: args.label,
      active: true,
      sortOrder: maxOrder + 1,
    });
  },
});

/** Update a vehicle (admin only) */
export const update = mutation({
  args: {
    id: v.id("vehicles"),
    registration: v.optional(v.string()),
    label: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can manage vehicles", code: "FORBIDDEN" });
    }

    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) {
      throw new ConvexError({ message: "Vehicle not found", code: "NOT_FOUND" });
    }

    // Check for duplicate registration if changing
    if (args.registration !== undefined && args.registration !== vehicle.registration) {
      const newReg = args.registration;
      const existing = await ctx.db
        .query("vehicles")
        .withIndex("by_registration", (q) => q.eq("registration", newReg))
        .first();
      if (existing) {
        throw new ConvexError({
          message: `Vehicle "${newReg}" already exists`,
          code: "CONFLICT",
        });
      }
    }

    const patch: { registration?: string; label?: string; active?: boolean } = {};
    if (args.registration !== undefined) patch.registration = args.registration;
    if (args.label !== undefined) patch.label = args.label;
    if (args.active !== undefined) patch.active = args.active;

    await ctx.db.patch(args.id, patch);
  },
});

/** Remove a vehicle (admin only) */
export const remove = mutation({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can manage vehicles", code: "FORBIDDEN" });
    }

    await ctx.db.delete(args.id);
  },
});

/** Reorder vehicles (admin only) */
export const reorder = mutation({
  args: { orderedIds: v.array(v.id("vehicles")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can manage vehicles", code: "FORBIDDEN" });
    }

    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { sortOrder: i + 1 });
    }
  },
});
