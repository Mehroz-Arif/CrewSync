import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";

const CATEGORY_VALIDATOR = v.union(
  v.literal("general"),
  v.literal("scheduling"),
  v.literal("workplace"),
  v.literal("suggestion"),
  v.literal("concern")
);

/**
 * Submit anonymous feedback.
 * Only requires the user to be logged in — no userId is stored.
 */
export const submit = mutation({
  args: {
    message: v.string(),
    category: CATEGORY_VALIDATOR,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    if (args.message.trim().length < 5) {
      throw new ConvexError({ message: "Feedback must be at least 5 characters", code: "BAD_REQUEST" });
    }
    if (args.message.length > 2000) {
      throw new ConvexError({ message: "Feedback must be under 2000 characters", code: "BAD_REQUEST" });
    }

    // Intentionally NOT storing userId to keep feedback anonymous
    await ctx.db.insert("feedback", {
      message: args.message.trim(),
      category: args.category,
      status: "new",
    });
  },
});

/** List all feedback (admin only), newest first */
export const list = query({
  args: {
    statusFilter: v.optional(
      v.union(v.literal("new"), v.literal("reviewed"), v.literal("archived"))
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can view feedback", code: "FORBIDDEN" });
    }

    const all = await ctx.db.query("feedback").order("desc").collect();

    if (args.statusFilter) {
      return all.filter((f) => f.status === args.statusFilter);
    }
    return all;
  },
});

/** Get feedback counts by status (admin only) */
export const getCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can view feedback", code: "FORBIDDEN" });
    }

    const all = await ctx.db.query("feedback").collect();
    return {
      total: all.length,
      new: all.filter((f) => f.status === "new").length,
      reviewed: all.filter((f) => f.status === "reviewed").length,
      archived: all.filter((f) => f.status === "archived").length,
    };
  },
});

/** Update feedback status (admin only) */
export const updateStatus = mutation({
  args: {
    feedbackId: v.id("feedback"),
    status: v.union(v.literal("new"), v.literal("reviewed"), v.literal("archived")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can update feedback", code: "FORBIDDEN" });
    }

    const existing = await ctx.db.get(args.feedbackId);
    if (!existing) {
      throw new ConvexError({ message: "Feedback not found", code: "NOT_FOUND" });
    }

    await ctx.db.patch(args.feedbackId, { status: args.status });
  },
});

/** Delete feedback (admin only) */
export const remove = mutation({
  args: { feedbackId: v.id("feedback") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can delete feedback", code: "FORBIDDEN" });
    }

    await ctx.db.delete(args.feedbackId);
  },
});
