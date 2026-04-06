import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import { checkUserShiftOverlap } from "./shifts";

/** Create a cover request for one of your shifts */
export const createRequest = mutation({
  args: {
    membershipId: v.id("shiftMembers"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new ConvexError({ message: "Shift assignment not found", code: "NOT_FOUND" });
    if (membership.userId !== currentUser._id) throw new ConvexError({ message: "You can only request cover for your own shifts", code: "FORBIDDEN" });
    if (membership.responseStatus !== "accepted") throw new ConvexError({ message: "You can only request cover for accepted shifts", code: "BAD_REQUEST" });

    // Prevent duplicate open requests for the same shift
    const existing = await ctx.db
      .query("coverRequests")
      .withIndex("by_shift", (q) => q.eq("shiftId", membership.shiftId))
      .collect();
    const hasOpen = existing.some((r) => r.status === "open" && r.requesterId === currentUser._id);
    if (hasOpen) throw new ConvexError({ message: "You already have an open cover request for this shift", code: "CONFLICT" });

    return await ctx.db.insert("coverRequests", {
      requesterId: currentUser._id,
      shiftId: membership.shiftId,
      membershipId: args.membershipId,
      reason: args.reason,
      status: "open",
    });
  },
});

/** Cancel your own cover request */
export const cancelRequest = mutation({
  args: { requestId: v.id("coverRequests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError({ message: "Cover request not found", code: "NOT_FOUND" });
    if (request.requesterId !== currentUser._id) throw new ConvexError({ message: "You can only cancel your own requests", code: "FORBIDDEN" });
    if (request.status !== "open") throw new ConvexError({ message: "Can only cancel open requests", code: "BAD_REQUEST" });

    await ctx.db.patch(args.requestId, { status: "cancelled" });
  },
});

/** Claim an open cover request (volunteer to cover the shift) */
export const claimRequest = mutation({
  args: { requestId: v.id("coverRequests") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError({ message: "Cover request not found", code: "NOT_FOUND" });
    if (request.status !== "open") throw new ConvexError({ message: "This cover request is no longer open", code: "BAD_REQUEST" });
    if (request.requesterId === currentUser._id) throw new ConvexError({ message: "You cannot cover your own shift", code: "BAD_REQUEST" });

    const shift = await ctx.db.get(request.shiftId);
    if (!shift) throw new ConvexError({ message: "Shift not found", code: "NOT_FOUND" });

    // Check that the claimer has the required position
    const shiftPosition = shift.position ?? shift.staffRole;
    if (shiftPosition) {
      const claimerPositions: string[] = currentUser.positions ?? (currentUser.jobTitle ? [currentUser.jobTitle] : []);
      if (!claimerPositions.includes(shiftPosition)) {
        throw new ConvexError({
          message: `You do not hold the "${shiftPosition}" position required for this shift`,
          code: "BAD_REQUEST",
        });
      }
    }

    // Check for time overlap
    await checkUserShiftOverlap(ctx, currentUser._id, shift.startTime, shift.endTime);

    const membership = await ctx.db.get(request.membershipId);
    if (!membership) throw new ConvexError({ message: "Shift assignment no longer exists", code: "NOT_FOUND" });

    // Reassign the shift membership to the claimer
    await ctx.db.patch(request.membershipId, {
      userId: currentUser._id,
      responseStatus: "accepted",
    });

    // Mark the cover request as claimed
    await ctx.db.patch(args.requestId, {
      status: "claimed",
      claimedByUserId: currentUser._id,
      claimedAt: new Date().toISOString(),
    });
  },
});

/** Get open cover requests visible to the current user (matching qualifications, excluding own) */
export const getOpenRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const myPositions: string[] = currentUser.positions ?? (currentUser.jobTitle ? [currentUser.jobTitle] : []);

    const openRequests = await ctx.db
      .query("coverRequests")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    const enriched = await Promise.all(
      openRequests
        .filter((r) => r.requesterId !== currentUser._id)
        .map(async (request) => {
          const requester = await ctx.db.get(request.requesterId);
          const shift = await ctx.db.get(request.shiftId);

          // Check if current user is qualified for this shift
          const shiftPosition = shift?.position ?? shift?.staffRole;
          const isQualified = !shiftPosition || myPositions.includes(shiftPosition);

          if (!isQualified) return null;

          return {
            _id: request._id,
            _creationTime: request._creationTime,
            reason: request.reason,
            requesterName: requester?.name ?? "Unknown",
            shift: shift
              ? {
                  startTime: shift.startTime,
                  endTime: shift.endTime,
                  vehicle: shift.vehicle,
                  callSign: shift.callSign,
                  position: shift.position ?? shift.staffRole,
                }
              : null,
          };
        })
    );

    return enriched
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Get current user's cover requests (both open and resolved) */
export const getMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const requests = await ctx.db
      .query("coverRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", currentUser._id))
      .collect();

    const enriched = await Promise.all(
      requests.map(async (request) => {
        const shift = await ctx.db.get(request.shiftId);
        const claimedBy = request.claimedByUserId
          ? await ctx.db.get(request.claimedByUserId)
          : null;

        return {
          _id: request._id,
          _creationTime: request._creationTime,
          status: request.status,
          reason: request.reason,
          claimedByName: claimedBy?.name,
          claimedAt: request.claimedAt,
          shift: shift
            ? {
                startTime: shift.startTime,
                endTime: shift.endTime,
                vehicle: shift.vehicle,
                callSign: shift.callSign,
                position: shift.position ?? shift.staffRole,
              }
            : null,
        };
      })
    );

    return enriched.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Count open cover requests for the current user's qualifications (for badge) */
export const getCoverCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const myPositions: string[] = currentUser.positions ?? (currentUser.jobTitle ? [currentUser.jobTitle] : []);

    const openRequests = await ctx.db
      .query("coverRequests")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    let openCount = 0;
    for (const request of openRequests) {
      if (request.requesterId === currentUser._id) continue;
      const shift = await ctx.db.get(request.shiftId);
      const shiftPosition = shift?.position ?? shift?.staffRole;
      if (!shiftPosition || myPositions.includes(shiftPosition)) {
        openCount++;
      }
    }

    // Count my open requests
    const myRequests = await ctx.db
      .query("coverRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", currentUser._id))
      .collect();
    const myOpenCount = myRequests.filter((r) => r.status === "open").length;

    return { openCount, myOpenCount };
  },
});

/** Admin report: Get all cover requests with details */
export const getAllForReport = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser || currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can view cover request reports", code: "FORBIDDEN" });
    }

    const allRequests = await ctx.db.query("coverRequests").collect();

    const enriched = await Promise.all(
      allRequests.map(async (request) => {
        const requester = await ctx.db.get(request.requesterId);
        const shift = await ctx.db.get(request.shiftId);
        const claimedBy = request.claimedByUserId
          ? await ctx.db.get(request.claimedByUserId)
          : null;

        return {
          _id: request._id,
          _creationTime: request._creationTime,
          status: request.status,
          reason: request.reason,
          requesterName: requester?.name ?? "Unknown",
          requesterId: request.requesterId,
          claimedByName: claimedBy?.name,
          claimedByUserId: request.claimedByUserId,
          claimedAt: request.claimedAt,
          shift: shift
            ? {
                startTime: shift.startTime,
                endTime: shift.endTime,
                vehicle: shift.vehicle,
                callSign: shift.callSign,
                position: shift.position ?? shift.staffRole,
              }
            : null,
        };
      })
    );

    return enriched.sort((a, b) => b._creationTime - a._creationTime);
  },
});
