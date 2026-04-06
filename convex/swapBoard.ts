import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import { checkUserShiftOverlap } from "./shifts";

/** Post a shift to the swap board */
export const createPosting = mutation({
  args: {
    membershipId: v.id("shiftMembers"),
    note: v.optional(v.string()),
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
    if (membership.userId !== currentUser._id) throw new ConvexError({ message: "You can only post your own shifts", code: "FORBIDDEN" });
    if (membership.responseStatus !== "accepted") throw new ConvexError({ message: "You can only post accepted shifts", code: "BAD_REQUEST" });

    // Check for existing open posting for this membership
    const existingPostings = await ctx.db
      .query("swapPostings")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();
    const hasOpen = existingPostings.some(
      (p) => p.status === "open" && p.membershipId === args.membershipId
    );
    if (hasOpen) throw new ConvexError({ message: "You already have an open posting for this shift", code: "CONFLICT" });

    return await ctx.db.insert("swapPostings", {
      userId: currentUser._id,
      shiftId: membership.shiftId,
      membershipId: args.membershipId,
      note: args.note,
      status: "open",
    });
  },
});

/** Cancel a swap board posting */
export const cancelPosting = mutation({
  args: { postingId: v.id("swapPostings") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const posting = await ctx.db.get(args.postingId);
    if (!posting) throw new ConvexError({ message: "Posting not found", code: "NOT_FOUND" });
    if (posting.userId !== currentUser._id) throw new ConvexError({ message: "You can only cancel your own postings", code: "FORBIDDEN" });
    if (posting.status !== "open") throw new ConvexError({ message: "Can only cancel open postings", code: "BAD_REQUEST" });

    // Cancel all pending offers on this posting
    const offers = await ctx.db
      .query("swapOffers")
      .withIndex("by_posting", (q) => q.eq("postingId", args.postingId))
      .collect();
    for (const offer of offers) {
      if (offer.status === "pending") {
        await ctx.db.patch(offer._id, { status: "cancelled" });
      }
    }

    await ctx.db.patch(args.postingId, { status: "cancelled" });
  },
});

/** Get all open swap board postings (excluding the current user's) */
export const getOpenPostings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const postings = await ctx.db
      .query("swapPostings")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    const enriched = await Promise.all(
      postings
        .filter((p) => p.userId !== currentUser._id)
        .map(async (posting) => {
          const user = await ctx.db.get(posting.userId);
          const shift = await ctx.db.get(posting.shiftId);

          const offers = await ctx.db
            .query("swapOffers")
            .withIndex("by_posting", (q) => q.eq("postingId", posting._id))
            .collect();
          const myOffer = offers.find(
            (o) => o.userId === currentUser._id && o.status === "pending"
          );
          const offerCount = offers.filter((o) => o.status === "pending").length;

          return {
            _id: posting._id,
            _creationTime: posting._creationTime,
            note: posting.note,
            userName: user?.name ?? "Unknown",
            shift: shift
              ? {
                  startTime: shift.startTime,
                  endTime: shift.endTime,
                  vehicle: shift.vehicle,
                  callSign: shift.callSign,
                  position: shift.position,
                }
              : null,
            hasMyOffer: !!myOffer,
            myOfferId: myOffer?._id ?? null,
            offerCount,
          };
        })
    );

    return enriched.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Offer your shift against a board posting */
export const makeOffer = mutation({
  args: {
    postingId: v.id("swapPostings"),
    membershipId: v.id("shiftMembers"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const posting = await ctx.db.get(args.postingId);
    if (!posting) throw new ConvexError({ message: "Posting not found", code: "NOT_FOUND" });
    if (posting.status !== "open") throw new ConvexError({ message: "This posting is no longer open", code: "BAD_REQUEST" });
    if (posting.userId === currentUser._id) throw new ConvexError({ message: "Cannot offer on your own posting", code: "BAD_REQUEST" });

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new ConvexError({ message: "Shift assignment not found", code: "NOT_FOUND" });
    if (membership.userId !== currentUser._id) throw new ConvexError({ message: "You can only offer your own shifts", code: "FORBIDDEN" });
    if (membership.responseStatus !== "accepted") throw new ConvexError({ message: "You can only offer accepted shifts", code: "BAD_REQUEST" });

    // Check for duplicate offer
    const existingOffers = await ctx.db
      .query("swapOffers")
      .withIndex("by_posting", (q) => q.eq("postingId", args.postingId))
      .collect();
    const hasDuplicate = existingOffers.some(
      (o) => o.userId === currentUser._id && o.status === "pending"
    );
    if (hasDuplicate) throw new ConvexError({ message: "You already have a pending offer on this posting", code: "CONFLICT" });

    return await ctx.db.insert("swapOffers", {
      postingId: args.postingId,
      userId: currentUser._id,
      shiftId: membership.shiftId,
      membershipId: args.membershipId,
      note: args.note,
      status: "pending",
    });
  },
});

/** Cancel your own offer */
export const cancelOffer = mutation({
  args: { offerId: v.id("swapOffers") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new ConvexError({ message: "Offer not found", code: "NOT_FOUND" });
    if (offer.userId !== currentUser._id) throw new ConvexError({ message: "You can only cancel your own offers", code: "FORBIDDEN" });
    if (offer.status !== "pending") throw new ConvexError({ message: "Can only cancel pending offers", code: "BAD_REQUEST" });

    await ctx.db.patch(args.offerId, { status: "cancelled" });
  },
});

/** Accept or decline an offer (posting owner only) */
export const respondToOffer = mutation({
  args: {
    offerId: v.id("swapOffers"),
    response: v.union(v.literal("accepted"), v.literal("declined")),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const offer = await ctx.db.get(args.offerId);
    if (!offer) throw new ConvexError({ message: "Offer not found", code: "NOT_FOUND" });
    if (offer.status !== "pending") throw new ConvexError({ message: "This offer is no longer pending", code: "BAD_REQUEST" });

    const posting = await ctx.db.get(offer.postingId);
    if (!posting) throw new ConvexError({ message: "Posting not found", code: "NOT_FOUND" });
    if (posting.userId !== currentUser._id) throw new ConvexError({ message: "Only the posting owner can respond", code: "FORBIDDEN" });

    if (args.response === "declined") {
      await ctx.db.patch(args.offerId, { status: "declined" });
      return;
    }

    // Accepting — perform the swap
    const posterMembership = await ctx.db.get(posting.membershipId);
    const offererMembership = await ctx.db.get(offer.membershipId);

    if (!posterMembership || !offererMembership) {
      throw new ConvexError({ message: "One or both shift assignments no longer exist", code: "NOT_FOUND" });
    }
    if (posterMembership.responseStatus !== "accepted" || offererMembership.responseStatus !== "accepted") {
      throw new ConvexError({ message: "Both shifts must still be accepted to complete the swap", code: "BAD_REQUEST" });
    }

    const posterShift = await ctx.db.get(posting.shiftId);
    const offererShift = await ctx.db.get(offer.shiftId);

    if (!posterShift || !offererShift) {
      throw new ConvexError({ message: "One or both shifts no longer exist", code: "NOT_FOUND" });
    }

    // Check for time overlaps after the swap
    await checkUserShiftOverlap(ctx, posting.userId, offererShift.startTime, offererShift.endTime, posting.shiftId);
    await checkUserShiftOverlap(ctx, offer.userId, posterShift.startTime, posterShift.endTime, offer.shiftId);

    // Perform the swap — update userId on both memberships
    await ctx.db.patch(posting.membershipId, { userId: offer.userId });
    await ctx.db.patch(offer.membershipId, { userId: posting.userId });

    // Update statuses
    await ctx.db.patch(args.offerId, { status: "accepted" });
    await ctx.db.patch(offer.postingId, { status: "matched" });

    // Cancel other pending offers on this posting
    const allOffers = await ctx.db
      .query("swapOffers")
      .withIndex("by_posting", (q) => q.eq("postingId", offer.postingId))
      .collect();
    for (const other of allOffers) {
      if (other._id !== args.offerId && other.status === "pending") {
        await ctx.db.patch(other._id, { status: "cancelled" });
      }
    }

    // Cancel any pending direct swaps involving either membership
    const allPendingSwaps = await ctx.db
      .query("shiftSwaps")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    for (const swap of allPendingSwaps) {
      if (
        swap.requesterMembershipId === posting.membershipId ||
        swap.requesterMembershipId === offer.membershipId ||
        swap.targetMembershipId === posting.membershipId ||
        swap.targetMembershipId === offer.membershipId
      ) {
        await ctx.db.patch(swap._id, { status: "cancelled" });
      }
    }
  },
});

/** Get current user's postings with their offers */
export const getMyPostings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const postings = await ctx.db
      .query("swapPostings")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    const enriched = await Promise.all(
      postings.map(async (posting) => {
        const shift = await ctx.db.get(posting.shiftId);
        const offers = await ctx.db
          .query("swapOffers")
          .withIndex("by_posting", (q) => q.eq("postingId", posting._id))
          .collect();

        const enrichedOffers = await Promise.all(
          offers.map(async (offer) => {
            const offerer = await ctx.db.get(offer.userId);
            const offerShift = await ctx.db.get(offer.shiftId);
            return {
              _id: offer._id,
              _creationTime: offer._creationTime,
              status: offer.status,
              note: offer.note,
              offererName: offerer?.name ?? "Unknown",
              shift: offerShift
                ? {
                    startTime: offerShift.startTime,
                    endTime: offerShift.endTime,
                    vehicle: offerShift.vehicle,
                    callSign: offerShift.callSign,
                    position: offerShift.position,
                  }
                : null,
            };
          })
        );

        return {
          _id: posting._id,
          _creationTime: posting._creationTime,
          status: posting.status,
          note: posting.note,
          shift: shift
            ? {
                startTime: shift.startTime,
                endTime: shift.endTime,
                vehicle: shift.vehicle,
                callSign: shift.callSign,
                position: shift.position,
              }
            : null,
          offers: enrichedOffers.sort((a, b) => b._creationTime - a._creationTime),
        };
      })
    );

    return enriched.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Get offers the current user has made on others' postings */
export const getMyOffers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const offers = await ctx.db
      .query("swapOffers")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    const enriched = await Promise.all(
      offers.map(async (offer) => {
        const posting = await ctx.db.get(offer.postingId);
        const posterUser = posting ? await ctx.db.get(posting.userId) : null;
        const posterShift = posting ? await ctx.db.get(posting.shiftId) : null;
        const myShift = await ctx.db.get(offer.shiftId);

        return {
          _id: offer._id,
          _creationTime: offer._creationTime,
          status: offer.status,
          note: offer.note,
          posterName: posterUser?.name ?? "Unknown",
          posterNote: posting?.note,
          posterShift: posterShift
            ? {
                startTime: posterShift.startTime,
                endTime: posterShift.endTime,
                vehicle: posterShift.vehicle,
                callSign: posterShift.callSign,
                position: posterShift.position,
              }
            : null,
          myShift: myShift
            ? {
                startTime: myShift.startTime,
                endTime: myShift.endTime,
                vehicle: myShift.vehicle,
                callSign: myShift.callSign,
                position: myShift.position,
              }
            : null,
          postingStatus: posting?.status ?? "cancelled",
        };
      })
    );

    return enriched.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Get current user's upcoming accepted shifts (for offering on the board) */
export const getMyAcceptedShifts = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_start_time", (q) =>
        q.gte("startTime", args.startDate).lt("startTime", args.endDate)
      )
      .collect();

    const myShifts: Array<{
      shiftId: Id<"shifts">;
      membershipId: Id<"shiftMembers">;
      startTime: string;
      endTime: string;
      vehicle: string;
      callSign?: string;
      position?: string;
    }> = [];

    for (const shift of shifts) {
      if (!shift.published) continue;
      const members = await ctx.db
        .query("shiftMembers")
        .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
        .collect();
      const myMembership = members.find(
        (m) => m.userId === currentUser._id && m.responseStatus === "accepted"
      );
      if (myMembership) {
        myShifts.push({
          shiftId: shift._id,
          membershipId: myMembership._id,
          startTime: shift.startTime,
          endTime: shift.endTime,
          vehicle: shift.vehicle,
          callSign: shift.callSign,
          position: shift.position,
        });
      }
    }

    return myShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
  },
});

/** Count of open postings from others + pending offers on your postings (for badge) */
export const getBoardCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });

    const openPostings = await ctx.db
      .query("swapPostings")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const boardCount = openPostings.filter((p) => p.userId !== currentUser._id).length;

    const myPostings = await ctx.db
      .query("swapPostings")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();
    let pendingOfferCount = 0;
    for (const posting of myPostings) {
      if (posting.status !== "open") continue;
      const offers = await ctx.db
        .query("swapOffers")
        .withIndex("by_posting", (q) => q.eq("postingId", posting._id))
        .collect();
      pendingOfferCount += offers.filter((o) => o.status === "pending").length;
    }

    return { boardCount, pendingOfferCount };
  },
});
