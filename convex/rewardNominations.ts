import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";

const VALID_CATEGORIES = [
  "great-work",
  "team-player",
  "above-and-beyond",
  "customer-hero",
  "innovation",
];

const VALID_POINTS = [10, 25, 50, 100];

/** Submit a nomination for a colleague */
export const nominate = mutation({
  args: {
    nomineeId: v.id("users"),
    reason: v.string(),
    category: v.string(),
    suggestedPoints: v.optional(v.number()),
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
    if (args.nomineeId === user._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "You cannot nominate yourself" });
    }
    if (!VALID_CATEGORIES.includes(args.category)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid category" });
    }
    if (args.suggestedPoints !== undefined && !VALID_POINTS.includes(args.suggestedPoints)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid point amount" });
    }
    const nominee = await ctx.db.get(args.nomineeId);
    if (!nominee) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Nominee not found" });
    }

    await ctx.db.insert("rewardNominations", {
      nominatedBy: user._id,
      nomineeId: args.nomineeId,
      reason: args.reason.trim(),
      category: args.category,
      suggestedPoints: args.suggestedPoints,
      status: "pending",
    });
  },
});

/** List all nominations — admin sees all, staff sees only their own */
export const list = query({
  args: {
    statusFilter: v.optional(v.string()),
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

    const isAdmin = user.role === "admin";

    let nominations;
    if (args.statusFilter && args.statusFilter !== "all") {
      nominations = await ctx.db
        .query("rewardNominations")
        .withIndex("by_status", (q) => q.eq("status", args.statusFilter as "pending" | "approved" | "rejected"))
        .order("desc")
        .collect();
    } else {
      nominations = await ctx.db
        .query("rewardNominations")
        .order("desc")
        .collect();
    }

    // Staff can only see nominations they submitted or nominations for them
    if (!isAdmin) {
      nominations = nominations.filter(
        (n) => n.nominatedBy === user._id || n.nomineeId === user._id
      );
    }

    // Resolve names
    const userIds = new Set<string>();
    for (const n of nominations) {
      userIds.add(String(n.nominatedBy));
      userIds.add(String(n.nomineeId));
      if (n.reviewedBy) userIds.add(String(n.reviewedBy));
    }
    const users = await ctx.db.query("users").collect();
    const nameMap = new Map(users.map((u) => [String(u._id), u.name ?? "Unknown"]));

    return nominations.map((n) => ({
      _id: n._id,
      _creationTime: n._creationTime,
      nominatedBy: n.nominatedBy,
      nominatedByName: nameMap.get(String(n.nominatedBy)) ?? "Unknown",
      nomineeId: n.nomineeId,
      nomineeName: nameMap.get(String(n.nomineeId)) ?? "Unknown",
      reason: n.reason,
      category: n.category,
      suggestedPoints: n.suggestedPoints,
      status: n.status,
      reviewedBy: n.reviewedBy,
      reviewedByName: n.reviewedBy ? (nameMap.get(String(n.reviewedBy)) ?? "Unknown") : undefined,
      reviewedAt: n.reviewedAt,
      reviewNote: n.reviewNote,
    }));
  },
});

/** Count pending nominations (for admin badge) */
export const pendingCount = query({
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
    if (!user || user.role !== "admin") return 0;

    const pending = await ctx.db
      .query("rewardNominations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending.length;
  },
});

/** Admin: approve a nomination — creates the actual reward */
export const approve = mutation({
  args: {
    nominationId: v.id("rewardNominations"),
    points: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin || admin.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can approve nominations" });
    }

    const nomination = await ctx.db.get(args.nominationId);
    if (!nomination) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Nomination not found" });
    }
    if (nomination.status !== "pending") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nomination already reviewed" });
    }

    // Mark as approved
    await ctx.db.patch(args.nominationId, {
      status: "approved",
      reviewedBy: admin._id,
      reviewedAt: new Date().toISOString(),
      reviewNote: args.reviewNote?.trim(),
    });

    // Create the actual reward
    const finalPoints = args.points ?? nomination.suggestedPoints;
    await ctx.db.insert("rewards", {
      fromUserId: nomination.nominatedBy,
      toUserId: nomination.nomineeId,
      points: finalPoints,
      message: nomination.reason,
      category: nomination.category,
    });
  },
});

/** Admin: reject a nomination */
export const reject = mutation({
  args: {
    nominationId: v.id("rewardNominations"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin || admin.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can reject nominations" });
    }

    const nomination = await ctx.db.get(args.nominationId);
    if (!nomination) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Nomination not found" });
    }
    if (nomination.status !== "pending") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nomination already reviewed" });
    }

    await ctx.db.patch(args.nominationId, {
      status: "rejected",
      reviewedBy: admin._id,
      reviewedAt: new Date().toISOString(),
      reviewNote: args.reviewNote?.trim(),
    });
  },
});
