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
    const memberships = await ctx.db
      .query("shiftMembers")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

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
      if (shift.endTime >= now) {
        if (!nextShift || shift.startTime < nextShift.startTime) {
          nextShift = shift;
        }
      }
    }

    if (!nextShift) return null;

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

/** Get shifts within a date range, enriched with member details */
export const getShiftsByDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_start_time", (q) =>
        q.gte("startTime", args.startDate).lt("startTime", args.endDate)
      )
      .collect();

    return await Promise.all(
      shifts.map(async (shift) => {
        const members = await ctx.db
          .query("shiftMembers")
          .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
          .collect();

        const memberDetails = await Promise.all(
          members.map(async (m) => {
            const user = await ctx.db.get(m.userId);
            return {
              membershipId: m._id,
              userId: m.userId,
              name: user?.name ?? "Unknown",
            };
          })
        );

        return { ...shift, members: memberDetails };
      })
    );
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
    const shiftId = await ctx.db.insert("shifts", {
      startTime: args.startTime,
      endTime: args.endTime,
      vehicle: args.vehicle,
      notes: args.notes,
      createdBy: currentUser._id,
    });

    for (const memberId of args.memberIds) {
      await ctx.db.insert("shiftMembers", { shiftId, userId: memberId });
    }
    return shiftId;
  },
});

/** Update shift details and optionally its member list (admin only) */
export const update = mutation({
  args: {
    shiftId: v.id("shifts"),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    vehicle: v.optional(v.string()),
    notes: v.optional(v.string()),
    memberIds: v.optional(v.array(v.id("users"))),
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
    if (!currentUser || currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can update shifts", code: "FORBIDDEN" });
    }

    const { shiftId, memberIds, ...fields } = args;
    const patch: { startTime?: string; endTime?: string; vehicle?: string; notes?: string } = {};
    if (fields.startTime !== undefined) patch.startTime = fields.startTime;
    if (fields.endTime !== undefined) patch.endTime = fields.endTime;
    if (fields.vehicle !== undefined) patch.vehicle = fields.vehicle;
    if (fields.notes !== undefined) patch.notes = fields.notes;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(shiftId, patch);
    }

    // Sync member list if provided
    if (memberIds !== undefined) {
      const currentMembers = await ctx.db
        .query("shiftMembers")
        .withIndex("by_shift", (q) => q.eq("shiftId", shiftId))
        .collect();

      const currentIds = new Set(currentMembers.map((m) => m.userId));
      const newIds = new Set(memberIds);

      for (const m of currentMembers) {
        if (!newIds.has(m.userId)) await ctx.db.delete(m._id);
      }
      for (const uid of memberIds) {
        if (!currentIds.has(uid)) {
          await ctx.db.insert("shiftMembers", { shiftId, userId: uid });
        }
      }
    }
  },
});

/** Delete a shift and all its member assignments (admin only) */
export const remove = mutation({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser || currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can delete shifts", code: "FORBIDDEN" });
    }

    const members = await ctx.db
      .query("shiftMembers")
      .withIndex("by_shift", (q) => q.eq("shiftId", args.shiftId))
      .collect();
    for (const m of members) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(args.shiftId);
  },
});

/** Move a shift assignment via drag-and-drop (admin only) */
export const moveShiftAssignment = mutation({
  args: {
    membershipId: v.id("shiftMembers"),
    targetUserId: v.id("users"),
    dayOffset: v.number(),
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
    if (!currentUser || currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can move shifts", code: "FORBIDDEN" });
    }

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) {
      throw new ConvexError({ message: "Shift assignment not found", code: "NOT_FOUND" });
    }
    const shift = await ctx.db.get(membership.shiftId);
    if (!shift) {
      throw new ConvexError({ message: "Shift not found", code: "NOT_FOUND" });
    }

    const sameUser = membership.userId === args.targetUserId;
    const sameDay = args.dayOffset === 0;
    if (sameUser && sameDay) return;

    if (sameDay) {
      // Same day, different employee — reassign
      const existing = await ctx.db
        .query("shiftMembers")
        .withIndex("by_shift", (q) => q.eq("shiftId", membership.shiftId))
        .collect();
      if (existing.some((m) => m.userId === args.targetUserId)) {
        throw new ConvexError({ message: "Already assigned to this shift", code: "CONFLICT" });
      }
      await ctx.db.delete(args.membershipId);
      await ctx.db.insert("shiftMembers", {
        shiftId: membership.shiftId,
        userId: args.targetUserId,
      });
      return;
    }

    // Different day — create new shift with adjusted times
    const offsetMs = args.dayOffset * 86400000;
    const newStart = new Date(new Date(shift.startTime).getTime() + offsetMs).toISOString();
    const newEnd = new Date(new Date(shift.endTime).getTime() + offsetMs).toISOString();

    await ctx.db.delete(args.membershipId);

    const newShiftId = await ctx.db.insert("shifts", {
      startTime: newStart,
      endTime: newEnd,
      vehicle: shift.vehicle,
      notes: shift.notes,
      createdBy: shift.createdBy,
    });
    await ctx.db.insert("shiftMembers", {
      shiftId: newShiftId,
      userId: args.targetUserId,
    });

    // Clean up orphan shift if no members remain
    const remaining = await ctx.db
      .query("shiftMembers")
      .withIndex("by_shift", (q) => q.eq("shiftId", membership.shiftId))
      .collect();
    if (remaining.length === 0) {
      await ctx.db.delete(membership.shiftId);
    }
  },
});

/** Get unassigned shifts (shifts with no members) for a date range */
export const getUnassignedByDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_start_time", (q) =>
        q.gte("startTime", args.startDate).lt("startTime", args.endDate)
      )
      .collect();

    const unassigned = [];
    for (const shift of shifts) {
      const members = await ctx.db
        .query("shiftMembers")
        .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
        .collect();
      if (members.length === 0) {
        unassigned.push(shift);
      }
    }
    return unassigned;
  },
});

/** Assign a user to an existing shift (admin only) */
export const assignToShift = mutation({
  args: {
    shiftId: v.id("shifts"),
    userId: v.id("users"),
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
    if (!currentUser || currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can assign shifts", code: "FORBIDDEN" });
    }

    const shift = await ctx.db.get(args.shiftId);
    if (!shift) {
      throw new ConvexError({ message: "Shift not found", code: "NOT_FOUND" });
    }

    // Check if already assigned
    const existing = await ctx.db
      .query("shiftMembers")
      .withIndex("by_shift", (q) => q.eq("shiftId", args.shiftId))
      .collect();

    if (existing.some((m) => m.userId === args.userId)) {
      throw new ConvexError({ message: "User already assigned to this shift", code: "CONFLICT" });
    }

    await ctx.db.insert("shiftMembers", {
      shiftId: args.shiftId,
      userId: args.userId,
    });
  },
});

/** Get shifts for a specific user within a date range (only published) */
export const getMyShiftsByDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    const memberships = await ctx.db
      .query("shiftMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const shifts = [];
    for (const mem of memberships) {
      const shift = await ctx.db.get(mem.shiftId);
      if (!shift) continue;
      // Only show published shifts to team members
      if (!shift.published) continue;
      if (shift.startTime >= args.startDate && shift.startTime < args.endDate) {
        const allMembers = await ctx.db
          .query("shiftMembers")
          .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
          .collect();

        const memberDetails = await Promise.all(
          allMembers.map(async (m) => {
            const u = await ctx.db.get(m.userId);
            return { userId: m.userId, name: u?.name ?? "Unknown" };
          })
        );

        shifts.push({
          ...shift,
          membershipId: mem._id,
          members: memberDetails,
        });
      }
    }
    return shifts;
  },
});

/** Unassign a user from a shift — only if the shift is not published (admin only) */
export const unassignFromShift = mutation({
  args: { membershipId: v.id("shiftMembers") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser || currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can unassign shifts", code: "FORBIDDEN" });
    }

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) {
      throw new ConvexError({ message: "Assignment not found", code: "NOT_FOUND" });
    }

    const shift = await ctx.db.get(membership.shiftId);
    if (!shift) {
      throw new ConvexError({ message: "Shift not found", code: "NOT_FOUND" });
    }

    if (shift.published) {
      throw new ConvexError({
        message: "Cannot unassign a published shift. Unpublish it first.",
        code: "BAD_REQUEST",
      });
    }

    await ctx.db.delete(args.membershipId);
  },
});

/** Publish or unpublish shifts for a date range (admin only) */
export const setPublished = mutation({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    published: v.boolean(),
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
    if (!currentUser || currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can publish shifts", code: "FORBIDDEN" });
    }

    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_start_time", (q) =>
        q.gte("startTime", args.startDate).lt("startTime", args.endDate)
      )
      .collect();

    let count = 0;
    for (const shift of shifts) {
      // Only publish assigned shifts, skip unassigned
      if (args.published) {
        const members = await ctx.db
          .query("shiftMembers")
          .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
          .collect();
        if (members.length === 0) continue;
      }
      if (shift.published !== args.published) {
        await ctx.db.patch(shift._id, { published: args.published });
        count++;
      }
    }
    return count;
  },
});
