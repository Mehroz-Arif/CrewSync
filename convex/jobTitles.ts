import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

/** List all active job titles, sorted by sortOrder */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const titles = await ctx.db.query("jobTitles").collect();
    return titles
      .filter((t) => t.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** List ALL job titles (active + inactive) for the admin settings editor */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const titles = await ctx.db.query("jobTitles").collect();
    return titles.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** Create a new job title */
export const create = mutation({
  args: {
    label: v.string(),
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
      throw new ConvexError({ message: "Only admins can manage job titles", code: "FORBIDDEN" });
    }

    // Get the next sort order
    const existing = await ctx.db.query("jobTitles").collect();
    const maxOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), 0);

    return await ctx.db.insert("jobTitles", {
      label: args.label.trim(),
      sortOrder: maxOrder + 1,
      active: true,
    });
  },
});

/** Update a job title's label or active status */
export const update = mutation({
  args: {
    id: v.id("jobTitles"),
    label: v.optional(v.string()),
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
      throw new ConvexError({ message: "Only admins can manage job titles", code: "FORBIDDEN" });
    }

    const patch: Record<string, string | boolean> = {};
    if (args.label !== undefined) patch.label = args.label.trim();
    if (args.active !== undefined) patch.active = args.active;

    await ctx.db.patch(args.id, patch);
  },
});

/** Remove a job title permanently */
export const remove = mutation({
  args: { id: v.id("jobTitles") },
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
      throw new ConvexError({ message: "Only admins can manage job titles", code: "FORBIDDEN" });
    }

    await ctx.db.delete(args.id);
  },
});

/** Reorder job titles */
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("jobTitles")),
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
      throw new ConvexError({ message: "Only admins can manage job titles", code: "FORBIDDEN" });
    }

    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { sortOrder: i + 1 });
    }
  },
});
