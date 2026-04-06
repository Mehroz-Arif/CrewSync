import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";

const VALID_POINTS = [10, 25, 50, 100];
const VALID_CATEGORIES = [
  "great-work",
  "team-player",
  "above-and-beyond",
  "customer-hero",
  "innovation",
];

/** Give a reward to another team member */
export const give = mutation({
  args: {
    toUserId: v.id("users"),
    points: v.optional(v.number()),
    message: v.string(),
    category: v.string(),
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
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (args.toUserId === user._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "You cannot reward yourself" });
    }
    if (args.points !== undefined && !VALID_POINTS.includes(args.points)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid point amount" });
    }
    if (!VALID_CATEGORIES.includes(args.category)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid category" });
    }

    const recipient = await ctx.db.get(args.toUserId);
    if (!recipient) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Recipient not found" });
    }

    await ctx.db.insert("rewards", {
      fromUserId: user._id,
      toUserId: args.toUserId,
      points: args.points,
      message: args.message,
      category: args.category,
    });
  },
});

/** Get the current user's total reward points */
export const getMyBalance = query({
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
    if (!user) return 0;

    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_to_user", (q) => q.eq("toUserId", user._id))
      .collect();
    return rewards.reduce((sum, r) => sum + (r.points ?? 0), 0);
  },
});

/** Top 10 reward earners */
export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }

    const allRewards = await ctx.db.query("rewards").collect();
    const allUsers = await ctx.db.query("users").collect();

    // Sum points per recipient
    const pointsByUser = new Map<string, number>();
    for (const reward of allRewards) {
      const key = String(reward.toUserId);
      pointsByUser.set(key, (pointsByUser.get(key) ?? 0) + (reward.points ?? 0));
    }

    return allUsers
      .map((u) => ({
        userId: u._id,
        name: u.name ?? "Unknown",
        points: pointsByUser.get(String(u._id)) ?? 0,
      }))
      .filter((u) => u.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  },
});

/** 20 most recent reward events with user names attached */
export const getRecentActivity = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }

    const rewards = await ctx.db.query("rewards").order("desc").take(20);
    const allUsers = await ctx.db.query("users").collect();
    const nameMap = new Map(allUsers.map((u) => [String(u._id), u.name ?? "Unknown"]));

    return rewards.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      fromName: nameMap.get(String(r.fromUserId)) ?? "Unknown",
      toName: nameMap.get(String(r.toUserId)) ?? "Unknown",
      points: r.points,
      message: r.message,
      category: r.category,
    }));
  },
});

/** Get a specific user's rewards summary (for profile view) */
export const getUserRewardsSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }

    // Rewards received
    const received = await ctx.db
      .query("rewards")
      .withIndex("by_to_user", (q) => q.eq("toUserId", args.userId))
      .collect();

    // Rewards given
    const given = await ctx.db
      .query("rewards")
      .withIndex("by_from_user", (q) => q.eq("fromUserId", args.userId))
      .collect();

    const totalPointsReceived = received.reduce((sum, r) => sum + (r.points ?? 0), 0);
    const totalPointsGiven = given.reduce((sum, r) => sum + (r.points ?? 0), 0);

    // Category breakdown for received
    const categoryMap = new Map<string, number>();
    for (const r of received) {
      categoryMap.set(r.category, (categoryMap.get(r.category) ?? 0) + 1);
    }
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Recent received rewards with names
    const allUsers = await ctx.db.query("users").collect();
    const nameMap = new Map(allUsers.map((u) => [String(u._id), u.name ?? "Unknown"]));

    const recentReceived = received
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 5)
      .map((r) => ({
        _id: r._id,
        _creationTime: r._creationTime,
        fromName: nameMap.get(String(r.fromUserId)) ?? "Unknown",
        points: r.points,
        message: r.message,
        category: r.category,
      }));

    // Recognitions received
    const recognitions = await ctx.db
      .query("recognitions")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.userId))
      .collect();

    const recentRecognitions = recognitions
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 5)
      .map((r) => ({
        _id: r._id,
        _creationTime: r._creationTime,
        givenByName: nameMap.get(String(r.givenById)) ?? "Unknown",
        title: r.title,
        message: r.message,
        badge: r.badge,
      }));

    return {
      totalPointsReceived,
      totalPointsGiven,
      rewardsReceivedCount: received.length,
      rewardsGivenCount: given.length,
      recognitionsCount: recognitions.length,
      categoryBreakdown,
      recentReceived,
      recentRecognitions,
    };
  },
});
