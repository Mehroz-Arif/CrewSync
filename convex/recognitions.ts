import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";

const VALID_BADGES = ["star", "heart", "trophy", "rocket", "gem"] as const;

/** Create a recognition (admin or super admin only) */
export const create = mutation({
  args: {
    recipientId: v.id("users"),
    title: v.string(),
    message: v.string(),
    badge: v.union(
      v.literal("star"),
      v.literal("heart"),
      v.literal("trophy"),
      v.literal("rocket"),
      v.literal("gem")
    ),
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
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can give recognitions" });
    }

    if (!args.title.trim() || !args.message.trim()) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Title and message are required" });
    }

    if (!VALID_BADGES.includes(args.badge)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid badge type" });
    }

    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Recipient not found" });
    }

    await ctx.db.insert("recognitions", {
      recipientId: args.recipientId,
      givenById: user._id,
      title: args.title.trim(),
      message: args.message.trim(),
      badge: args.badge,
    });
  },
});

/** Delete a recognition (admin or super admin only) */
export const remove = mutation({
  args: { recognitionId: v.id("recognitions") },
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
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can delete recognitions" });
    }

    const recognition = await ctx.db.get(args.recognitionId);
    if (!recognition) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Recognition not found" });
    }

    await ctx.db.delete(args.recognitionId);
  },
});

/** Get recent recognitions for the dashboard (latest 10) */
export const getRecent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }

    const recognitions = await ctx.db.query("recognitions").order("desc").take(10);
    const allUsers = await ctx.db.query("users").collect();
    const nameMap = new Map(allUsers.map((u) => [String(u._id), u.name ?? "Unknown"]));

    return recognitions.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      recipientId: r.recipientId,
      givenById: r.givenById,
      recipientName: nameMap.get(String(r.recipientId)) ?? "Unknown",
      givenByName: nameMap.get(String(r.givenById)) ?? "Unknown",
      title: r.title,
      message: r.message,
      badge: r.badge,
    }));
  },
});
