import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";

const LEAVE_TYPE_VALIDATOR = v.union(
  v.literal("annual"),
  v.literal("sick"),
  v.literal("compassionate"),
  v.literal("training"),
  v.literal("unpaid"),
  v.literal("other")
);

// ─── Queries ────────────────────────────────────────────────

/** Get the current user's leave requests */
export const getMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    const leaveRequests = await ctx.db
      .query("leaveRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Enrich with reviewer name
    const enriched = await Promise.all(
      leaveRequests.map(async (lr) => {
        const reviewer = lr.reviewedBy ? await ctx.db.get(lr.reviewedBy) : null;
        return {
          ...lr,
          reviewerName: reviewer?.name ?? undefined,
        };
      })
    );

    // Sort newest first
    return enriched.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Get all leave requests (admin only), optionally filtered by status */
export const getAllRequests = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") return [];

    let requests;
    if (args.status) {
      requests = await ctx.db
        .query("leaveRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      requests = await ctx.db.query("leaveRequests").collect();
    }

    // Enrich with user and reviewer data
    const enriched = await Promise.all(
      requests.map(async (lr) => {
        const reqUser = await ctx.db.get(lr.userId);
        const reviewer = lr.reviewedBy ? await ctx.db.get(lr.reviewedBy) : null;
        return {
          ...lr,
          userName: reqUser?.name ?? "Unknown",
          userRole: reqUser?.role,
          reviewerName: reviewer?.name ?? undefined,
        };
      })
    );

    // Sort: pending first, then by creation time (newest first)
    return enriched.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return b._creationTime - a._creationTime;
    });
  },
});

/** Get approved leave for a date range (for showing on schedules) */
export const getApprovedByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const approved = await ctx.db
      .query("leaveRequests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    // Filter to those overlapping the date range
    const overlapping = approved.filter(
      (lr) => lr.startDate <= args.endDate && lr.endDate >= args.startDate
    );

    // Enrich with user name
    const enriched = await Promise.all(
      overlapping.map(async (lr) => {
        const reqUser = await ctx.db.get(lr.userId);
        return {
          ...lr,
          userName: reqUser?.name ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

// ─── Mutations ──────────────────────────────────────────────

/** Submit a new leave request */
export const submit = mutation({
  args: {
    leaveType: LEAVE_TYPE_VALIDATOR,
    startDate: v.string(),
    endDate: v.string(),
    reason: v.optional(v.string()),
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
    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    if (args.startDate > args.endDate) {
      throw new ConvexError({ message: "Start date must be before or equal to end date", code: "BAD_REQUEST" });
    }

    // Check for overlapping pending/approved requests
    const existing = await ctx.db
      .query("leaveRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const overlap = existing.find(
      (lr) =>
        (lr.status === "pending" || lr.status === "approved") &&
        lr.startDate <= args.endDate &&
        lr.endDate >= args.startDate
    );

    if (overlap) {
      throw new ConvexError({
        message: "You already have a leave request for these dates",
        code: "CONFLICT",
      });
    }

    return await ctx.db.insert("leaveRequests", {
      userId: user._id,
      leaveType: args.leaveType,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason,
      status: "pending",
    });
  },
});

/** Cancel a leave request (only own, only pending) */
export const cancel = mutation({
  args: { requestId: v.id("leaveRequests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request || request.userId !== user._id) {
      throw new ConvexError({ message: "Request not found", code: "NOT_FOUND" });
    }
    if (request.status !== "pending") {
      throw new ConvexError({ message: "Only pending requests can be cancelled", code: "BAD_REQUEST" });
    }

    await ctx.db.patch(args.requestId, { status: "cancelled" });
  },
});

/** Admin: create an absence on behalf of a team member (auto-approved) */
export const adminCreateAbsence = mutation({
  args: {
    userId: v.id("users"),
    leaveType: LEAVE_TYPE_VALIDATOR,
    startDate: v.string(),
    endDate: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    }
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin || admin.role !== "admin") {
      throw new ConvexError({ message: "Only admins can create absences", code: "FORBIDDEN" });
    }

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    if (args.startDate > args.endDate) {
      throw new ConvexError({ message: "Start date must be before or equal to end date", code: "BAD_REQUEST" });
    }

    // Check for overlapping pending/approved requests
    const existing = await ctx.db
      .query("leaveRequests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const overlap = existing.find(
      (lr) =>
        (lr.status === "pending" || lr.status === "approved") &&
        lr.startDate <= args.endDate &&
        lr.endDate >= args.startDate
    );

    if (overlap) {
      throw new ConvexError({
        message: "This person already has a leave request for these dates",
        code: "CONFLICT",
      });
    }

    return await ctx.db.insert("leaveRequests", {
      userId: args.userId,
      leaveType: args.leaveType,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason,
      status: "approved",
      reviewedBy: admin._id,
      reviewedAt: new Date().toISOString(),
    });
  },
});

/** Admin: approve or reject a leave request */
export const review = mutation({
  args: {
    requestId: v.id("leaveRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    reviewNotes: v.optional(v.string()),
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
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can review leave requests", code: "FORBIDDEN" });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError({ message: "Request not found", code: "NOT_FOUND" });
    }
    if (request.status !== "pending") {
      throw new ConvexError({ message: "Can only review pending requests", code: "BAD_REQUEST" });
    }

    await ctx.db.patch(args.requestId, {
      status: args.decision,
      reviewedBy: user._id,
      reviewedAt: new Date().toISOString(),
      reviewNotes: args.reviewNotes,
    });
  },
});
