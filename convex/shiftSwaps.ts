import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { checkUserShiftOverlap } from "./shifts";

/** Get accepted shifts from other staff members that could be swapped with.
 *  Returns shifts grouped by user within a date range. */
export const getSwapCandidates = query({
  args: {
    shiftId: v.id("shifts"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Get all published shifts in the date range
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_start_time", (q) =>
        q.gte("startTime", args.startDate).lt("startTime", args.endDate)
      )
      .collect();

    // Build a map of user → accepted shifts (excluding the requester)
    const candidateMap = new Map<string, {
      user: { _id: Id<"users">; name: string; positions: string[] };
      shifts: Array<{
        shiftId: Id<"shifts">;
        membershipId: Id<"shiftMembers">;
        startTime: string;
        endTime: string;
        vehicle: string;
        callSign?: string;
        position?: string;
      }>;
    }>();

    for (const shift of shifts) {
      if (!shift.published) continue;
      // Skip the requester's own shift
      if (shift._id === args.shiftId) continue;

      const members = await ctx.db
        .query("shiftMembers")
        .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
        .collect();

      for (const member of members) {
        // Skip the requester's memberships
        if (member.userId === currentUser._id) continue;
        // Only show accepted shifts
        if (member.responseStatus !== "accepted") continue;

        const existing = candidateMap.get(member.userId);
        if (existing) {
          existing.shifts.push({
            shiftId: shift._id,
            membershipId: member._id,
            startTime: shift.startTime,
            endTime: shift.endTime,
            vehicle: shift.vehicle,
            callSign: shift.callSign,
            position: shift.position,
          });
        } else {
          const user = await ctx.db.get(member.userId);
          if (user) {
            candidateMap.set(member.userId, {
              user: {
                _id: user._id,
                name: user.name ?? "Unknown",
                positions: user.positions ?? [],
              },
              shifts: [{
                shiftId: shift._id,
                membershipId: member._id,
                startTime: shift.startTime,
                endTime: shift.endTime,
                vehicle: shift.vehicle,
                callSign: shift.callSign,
                position: shift.position,
              }],
            });
          }
        }
      }
    }

    return Array.from(candidateMap.values()).sort((a, b) =>
      a.user.name.localeCompare(b.user.name)
    );
  },
});

/** Create a shift swap request */
export const requestSwap = mutation({
  args: {
    requesterMembershipId: v.id("shiftMembers"),
    targetMembershipId: v.id("shiftMembers"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Validate requester membership
    const requesterMembership = await ctx.db.get(args.requesterMembershipId);
    if (!requesterMembership) {
      throw new ConvexError({ message: "Your shift assignment not found", code: "NOT_FOUND" });
    }
    if (requesterMembership.userId !== currentUser._id) {
      throw new ConvexError({ message: "You can only request swaps for your own shifts", code: "FORBIDDEN" });
    }
    if (requesterMembership.responseStatus !== "accepted") {
      throw new ConvexError({ message: "You can only swap accepted shifts", code: "BAD_REQUEST" });
    }

    const requesterShift = await ctx.db.get(requesterMembership.shiftId);
    if (!requesterShift) {
      throw new ConvexError({ message: "Shift not found", code: "NOT_FOUND" });
    }

    // Validate target membership
    const targetMembership = await ctx.db.get(args.targetMembershipId);
    if (!targetMembership) {
      throw new ConvexError({ message: "Target shift assignment not found", code: "NOT_FOUND" });
    }
    if (targetMembership.userId === currentUser._id) {
      throw new ConvexError({ message: "Cannot swap with yourself", code: "BAD_REQUEST" });
    }
    if (targetMembership.responseStatus !== "accepted") {
      throw new ConvexError({ message: "Target shift must be accepted", code: "BAD_REQUEST" });
    }

    const targetShift = await ctx.db.get(targetMembership.shiftId);
    if (!targetShift) {
      throw new ConvexError({ message: "Target shift not found", code: "NOT_FOUND" });
    }

    // Check for existing pending swap for same requester shift
    const existingSwaps = await ctx.db
      .query("shiftSwaps")
      .withIndex("by_requester", (q) => q.eq("requesterUserId", currentUser._id))
      .collect();

    const hasPending = existingSwaps.some(
      (s) => s.status === "pending" && s.requesterMembershipId === args.requesterMembershipId
    );
    if (hasPending) {
      throw new ConvexError({
        message: "You already have a pending swap request for this shift. Cancel it first.",
        code: "CONFLICT",
      });
    }

    return await ctx.db.insert("shiftSwaps", {
      requesterUserId: currentUser._id,
      requesterShiftId: requesterMembership.shiftId,
      requesterMembershipId: args.requesterMembershipId,
      targetUserId: targetMembership.userId,
      targetShiftId: targetMembership.shiftId,
      targetMembershipId: args.targetMembershipId,
      reason: args.reason,
      status: "pending",
    });
  },
});

/** Accept or decline a swap request (target user) */
export const respondToSwap = mutation({
  args: {
    swapId: v.id("shiftSwaps"),
    response: v.union(v.literal("accepted"), v.literal("declined")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    const swap = await ctx.db.get(args.swapId);
    if (!swap) {
      throw new ConvexError({ message: "Swap request not found", code: "NOT_FOUND" });
    }
    if (swap.targetUserId !== currentUser._id) {
      throw new ConvexError({ message: "You can only respond to swap requests sent to you", code: "FORBIDDEN" });
    }
    if (swap.status !== "pending") {
      throw new ConvexError({ message: "This swap request is no longer pending", code: "BAD_REQUEST" });
    }

    if (args.response === "declined") {
      await ctx.db.patch(args.swapId, { status: "declined" });
      return;
    }

    // Accepting — perform the swap
    const requesterMembership = await ctx.db.get(swap.requesterMembershipId);
    const targetMembership = await ctx.db.get(swap.targetMembershipId);

    if (!requesterMembership || !targetMembership) {
      throw new ConvexError({ message: "One or both shift assignments no longer exist", code: "NOT_FOUND" });
    }

    // Verify both still accepted
    if (requesterMembership.responseStatus !== "accepted" || targetMembership.responseStatus !== "accepted") {
      throw new ConvexError({ message: "Both shifts must still be accepted to complete the swap", code: "BAD_REQUEST" });
    }

    const requesterShift = await ctx.db.get(swap.requesterShiftId);
    const targetShift = await ctx.db.get(swap.targetShiftId);

    if (!requesterShift || !targetShift) {
      throw new ConvexError({ message: "One or both shifts no longer exist", code: "NOT_FOUND" });
    }

    // Check for time overlaps after the swap
    // Requester will be on targetShift — check against requester's other shifts
    await checkUserShiftOverlap(ctx, swap.requesterUserId, targetShift.startTime, targetShift.endTime, swap.requesterShiftId);
    // Target will be on requesterShift — check against target's other shifts
    await checkUserShiftOverlap(ctx, swap.targetUserId, requesterShift.startTime, requesterShift.endTime, swap.targetShiftId);

    // Perform the swap — update userId on both memberships
    await ctx.db.patch(swap.requesterMembershipId, { userId: swap.targetUserId });
    await ctx.db.patch(swap.targetMembershipId, { userId: swap.requesterUserId });

    await ctx.db.patch(args.swapId, { status: "accepted" });

    // Cancel any other pending swaps involving either of these memberships
    const allPendingSwaps = await ctx.db
      .query("shiftSwaps")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    for (const other of allPendingSwaps) {
      if (other._id === args.swapId) continue;
      if (
        other.requesterMembershipId === swap.requesterMembershipId ||
        other.requesterMembershipId === swap.targetMembershipId ||
        other.targetMembershipId === swap.requesterMembershipId ||
        other.targetMembershipId === swap.targetMembershipId
      ) {
        await ctx.db.patch(other._id, { status: "cancelled" });
      }
    }
  },
});

/** Cancel a swap request (requester only) */
export const cancelSwap = mutation({
  args: { swapId: v.id("shiftSwaps") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    const swap = await ctx.db.get(args.swapId);
    if (!swap) {
      throw new ConvexError({ message: "Swap request not found", code: "NOT_FOUND" });
    }
    if (swap.requesterUserId !== currentUser._id) {
      throw new ConvexError({ message: "You can only cancel your own swap requests", code: "FORBIDDEN" });
    }
    if (swap.status !== "pending") {
      throw new ConvexError({ message: "Can only cancel pending swap requests", code: "BAD_REQUEST" });
    }

    await ctx.db.patch(args.swapId, { status: "cancelled" });
  },
});

/** Get all swap requests relevant to the current user (sent + received) */
export const getMySwapRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Get sent requests
    const sent = await ctx.db
      .query("shiftSwaps")
      .withIndex("by_requester", (q) => q.eq("requesterUserId", currentUser._id))
      .collect();

    // Get received requests
    const received = await ctx.db
      .query("shiftSwaps")
      .withIndex("by_target", (q) => q.eq("targetUserId", currentUser._id))
      .collect();

    // Enrich all swap requests with user and shift details
    async function enrichSwap(swap: Doc<"shiftSwaps">) {
      const requesterUser = await ctx.db.get(swap.requesterUserId);
      const targetUser = await ctx.db.get(swap.targetUserId);
      const requesterShift = await ctx.db.get(swap.requesterShiftId);
      const targetShift = await ctx.db.get(swap.targetShiftId);

      return {
        ...swap,
        requesterName: requesterUser?.name ?? "Unknown",
        targetName: targetUser?.name ?? "Unknown",
        requesterShift: requesterShift
          ? {
              startTime: requesterShift.startTime,
              endTime: requesterShift.endTime,
              vehicle: requesterShift.vehicle,
              callSign: requesterShift.callSign,
              position: requesterShift.position,
            }
          : null,
        targetShift: targetShift
          ? {
              startTime: targetShift.startTime,
              endTime: targetShift.endTime,
              vehicle: targetShift.vehicle,
              callSign: targetShift.callSign,
              position: targetShift.position,
            }
          : null,
      };
    }

    const enrichedSent = await Promise.all(sent.map(enrichSwap));
    const enrichedReceived = await Promise.all(received.map(enrichSwap));

    return {
      sent: enrichedSent.sort((a, b) => b._creationTime - a._creationTime),
      received: enrichedReceived.sort((a, b) => b._creationTime - a._creationTime),
    };
  },
});
