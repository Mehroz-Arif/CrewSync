import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";

/** Get the current user's next upcoming shift */
export const getNextShift = query({
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

    const now = new Date().toISOString();

    // Get all shift memberships for this user
    const memberships = await ctx.db
      .query("shiftMembers")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    // Fetch shifts and find the next upcoming one
    let nextShift: {
      _id: typeof memberships[0]["shiftId"];
      startTime: string;
      endTime: string;
      vehicle: string;
      notes?: string;
    } | null = null;

    for (const mem of memberships) {
      const shift = await ctx.db.get(mem.shiftId);
      if (!shift) continue;
      // Include shifts that haven't ended yet
      if (shift.endTime >= now) {
        if (!nextShift || shift.startTime < nextShift.startTime) {
          nextShift = shift;
        }
      }
    }

    if (!nextShift) return null;

    // Get all crew members for this shift
    const shiftMembers = await ctx.db
      .query("shiftMembers")
      .withIndex("by_shift", (q) => q.eq("shiftId", nextShift._id))
      .collect();

    const crewMembers = await Promise.all(
      shiftMembers.map(async (sm) => {
        const user = await ctx.db.get(sm.userId);
        return user ? { _id: user._id, name: user.name ?? "Unknown" } : null;
      })
    );

    return {
      _id: nextShift._id,
      startTime: nextShift.startTime,
      endTime: nextShift.endTime,
      vehicle: nextShift.vehicle,
      notes: nextShift.notes,
      crew: crewMembers.filter((c): c is NonNullable<typeof c> => c !== null),
    };
  },
});

/** Create a new shift (admin only) */
export const create = mutation({
  args: {
    startTime: v.string(),
    endTime: v.string(),
    vehicle: v.string(),
    notes: v.optional(v.string()),
    memberIds: v.array(v.id("users")),
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
    if (currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can create shifts", code: "FORBIDDEN" });
    }

    if (args.memberIds.length === 0) {
      throw new ConvexError({ message: "Must assign at least one crew member", code: "BAD_REQUEST" });
    }

    const shiftId = await ctx.db.insert("shifts", {
      startTime: args.startTime,
      endTime: args.endTime,
      vehicle: args.vehicle,
      notes: args.notes,
      createdBy: currentUser._id,
    });

    for (const memberId of args.memberIds) {
      await ctx.db.insert("shiftMembers", {
        shiftId,
        userId: memberId,
      });
    }

    return shiftId;
  },
});
