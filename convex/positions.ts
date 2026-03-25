import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

/** List all active positions, sorted by sortOrder */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const positions = await ctx.db.query("positions").collect();
    return positions
      .filter((t) => t.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** List ALL positions (active + inactive) for the admin settings editor */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const positions = await ctx.db.query("positions").collect();
    return positions.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** Create a new position */
export const create = mutation({
  args: {
    label: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ message: "Only admins can manage positions", code: "FORBIDDEN" });
    }

    // Get the next sort order
    const existing = await ctx.db.query("positions").collect();
    const maxOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), 0);

    return await ctx.db.insert("positions", {
      label: args.label.trim(),
      color: args.color,
      sortOrder: maxOrder + 1,
      active: true,
    });
  },
});

/** Update a position's label or active status */
export const update = mutation({
  args: {
    id: v.id("positions"),
    label: v.optional(v.string()),
    color: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ message: "Only admins can manage positions", code: "FORBIDDEN" });
    }

    const patch: Record<string, string | boolean> = {};
    if (args.label !== undefined) patch.label = args.label.trim();
    if (args.color !== undefined) patch.color = args.color;
    if (args.active !== undefined) patch.active = args.active;

    await ctx.db.patch(args.id, patch);
  },
});

/** Remove a position permanently */
export const remove = mutation({
  args: { id: v.id("positions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ message: "Only admins can manage positions", code: "FORBIDDEN" });
    }

    await ctx.db.delete(args.id);
  },
});

/** Reorder positions */
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("positions")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      throw new ConvexError({ message: "Only admins can manage positions", code: "FORBIDDEN" });
    }

    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { sortOrder: i + 1 });
    }
  },
});
