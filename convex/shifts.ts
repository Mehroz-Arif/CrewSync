import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

/** Check if assigning a user to a shift would cause a time overlap with their existing shifts */
export async function checkUserShiftOverlap(
  ctx: MutationCtx,
  userId: Id<"users">,
  startTime: string,
  endTime: string,
  excludeShiftId?: Id<"shifts">
) {
  const memberships = await ctx.db
    .query("shiftMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  for (const mem of memberships) {
    if (excludeShiftId && mem.shiftId === excludeShiftId) continue;
    const shift = await ctx.db.get(mem.shiftId);
    if (!shift) continue;
    // Two time ranges overlap if: start1 < end2 AND start2 < end1
    if (startTime < shift.endTime && shift.startTime < endTime) {
      const user = await ctx.db.get(userId);
      throw new ConvexError({
        message: `Shift overlaps with an existing shift for ${user?.name ?? "this staff member"}`,
        code: "CONFLICT",
      });
    }
  }
}

/** Check if a user has a position matching the shift's required position */
async function checkPositionMatch(
  ctx: MutationCtx,
  userId: Id<"users">,
  position?: string,
) {
  if (!position) return; // no position requirement on this shift
  const user = await ctx.db.get(userId);
  if (!user) return;

  // Support both new array field and legacy single string
  const userPositions: string[] = user.positions ?? (user.jobTitle ? [user.jobTitle] : []);

  if (!userPositions.includes(position)) {
    throw new ConvexError({
      message: `${user.name ?? "Staff member"} does not hold the "${position}" position — this shift requires it`,
      code: "BAD_REQUEST",
    });
  }
}

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
      callSign?: string;
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
      shiftMembers
        .filter((sm) => sm.userId !== currentUser._id) // exclude self
        .map(async (sm) => {
          const user = await ctx.db.get(sm.userId);
          return user
            ? {
                _id: user._id,
                name: user.name ?? "Unknown",
                positions: user.positions ?? [],
                avatarUrl: user.avatarUrl,
              }
            : null;
        })
    );

    // Look up allocated vehicle for this shift's callSign + date
    let allocatedVehicle: string | undefined;
    if (nextShift.callSign) {
      const shiftDate = nextShift.startTime.slice(0, 10); // "YYYY-MM-DD"
      const allocation = await ctx.db
        .query("vehicleAllocations")
        .withIndex("by_date_and_callSign", (q) =>
          q.eq("date", shiftDate).eq("callSign", nextShift.callSign!)
        )
        .first();
      if (allocation) {
        allocatedVehicle = allocation.vehicle;
      }
    }

    return {
      _id: nextShift._id,
      startTime: nextShift.startTime,
      endTime: nextShift.endTime,
      vehicle: nextShift.vehicle,
      allocatedVehicle,
      callSign: nextShift.callSign,
      notes: nextShift.notes,
      crew: crewMembers.filter((c): c is NonNullable<typeof c> => c !== null),
    };
  },
});

/** Build a lookup from callSign → position using active patterns */
async function buildCallSignPositionMap(ctx: { db: QueryCtx["db"] }): Promise<Record<string, string>> {
  const patterns = await ctx.db.query("shiftPatterns").collect();
  const map: Record<string, string> = {};
  for (const p of patterns) {
    const pos = p.position ?? p.staffRole; // fallback to legacy field
    if (p.callSign && pos) {
      map[p.callSign] = pos;
    }
  }
  return map;
}

/** Resolve a shift's effective position from its own field, legacy field, or pattern fallback */
function resolveShiftPosition(
  shift: { position?: string; staffRole?: string; callSign?: string },
  callSignPositionMap: Record<string, string>,
): string | undefined {
  return shift.position ?? shift.staffRole ?? (shift.callSign ? callSignPositionMap[shift.callSign] : undefined);
}

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

    // Build callSign→position fallback for older shifts
    const callSignPositionMap = await buildCallSignPositionMap(ctx);

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

        const position = resolveShiftPosition(shift, callSignPositionMap);

        return { ...shift, position, members: memberDetails };
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
    callSign: v.optional(v.string()),
    position: v.optional(v.string()),
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
    // Check for overlapping shifts and position match for each assigned member
    for (const memberId of args.memberIds) {
      await checkPositionMatch(ctx, memberId, args.position);
      await checkUserShiftOverlap(ctx, memberId, args.startTime, args.endTime);
    }

    const shiftId = await ctx.db.insert("shifts", {
      startTime: args.startTime,
      endTime: args.endTime,
      vehicle: args.vehicle,
      callSign: args.callSign,
      position: args.position,
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
    callSign: v.optional(v.string()),
    position: v.optional(v.string()),
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

    // Get current shift to determine final times for overlap check
    const currentShift = await ctx.db.get(shiftId);
    if (!currentShift) {
      throw new ConvexError({ message: "Shift not found", code: "NOT_FOUND" });
    }
    const finalStartTime = fields.startTime ?? currentShift.startTime;
    const finalEndTime = fields.endTime ?? currentShift.endTime;

    // Determine final member list for overlap check
    let finalMemberIds: Id<"users">[];
    if (memberIds !== undefined) {
      finalMemberIds = memberIds;
    } else {
      const existingMembers = await ctx.db
        .query("shiftMembers")
        .withIndex("by_shift", (q) => q.eq("shiftId", shiftId))
        .collect();
      finalMemberIds = existingMembers.map((m) => m.userId);
    }

    // Determine final position for match check
    const finalPosition = fields.position ?? currentShift.position ?? currentShift.staffRole;

    // Check for overlapping shifts and position match for all final members (exclude current shift)
    for (const uid of finalMemberIds) {
      await checkPositionMatch(ctx, uid, finalPosition);
      await checkUserShiftOverlap(ctx, uid, finalStartTime, finalEndTime, shiftId);
    }

    const patch: { startTime?: string; endTime?: string; vehicle?: string; callSign?: string; position?: string; notes?: string } = {};
    if (fields.startTime !== undefined) patch.startTime = fields.startTime;
    if (fields.endTime !== undefined) patch.endTime = fields.endTime;
    if (fields.vehicle !== undefined) patch.vehicle = fields.vehicle;
    if (fields.callSign !== undefined) patch.callSign = fields.callSign;
    if (fields.position !== undefined) patch.position = fields.position;
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

    // Derive position from pattern callSign for older shifts missing it
    const callSignPositionMap = await buildCallSignPositionMap(ctx);
    const effectivePosition = resolveShiftPosition(shift, callSignPositionMap);

    // Check position match for target user (skip if reassigning to same user on different day)
    if (!sameUser) {
      await checkPositionMatch(ctx, args.targetUserId, effectivePosition);
    }

    if (sameDay) {
      // Same day, different employee — reassign
      const existing = await ctx.db
        .query("shiftMembers")
        .withIndex("by_shift", (q) => q.eq("shiftId", membership.shiftId))
        .collect();
      if (existing.some((m) => m.userId === args.targetUserId)) {
        throw new ConvexError({ message: "Already assigned to this shift", code: "CONFLICT" });
      }
      // Prevent time overlap for target user
      await checkUserShiftOverlap(ctx, args.targetUserId, shift.startTime, shift.endTime);
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

    // Prevent time overlap for target user on the new day
    await checkUserShiftOverlap(ctx, args.targetUserId, newStart, newEnd);

    await ctx.db.delete(args.membershipId);

    const newShiftId = await ctx.db.insert("shifts", {
      startTime: newStart,
      endTime: newEnd,
      vehicle: shift.vehicle,
      callSign: shift.callSign,
      position: shift.position ?? shift.staffRole, // migrate legacy field
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

    // Build callSign→position fallback for older shifts
    const callSignPositionMap = await buildCallSignPositionMap(ctx);

    const unassigned = [];
    for (const shift of shifts) {
      const members = await ctx.db
        .query("shiftMembers")
        .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
        .collect();
      if (members.length === 0) {
        const position = resolveShiftPosition(shift, callSignPositionMap);
        unassigned.push({ ...shift, position });
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

    // Derive position from pattern callSign for older shifts missing it
    const callSignPositionMap = await buildCallSignPositionMap(ctx);
    const effectivePosition = resolveShiftPosition(shift, callSignPositionMap);

    // Prevent position mismatch and time overlap
    await checkPositionMatch(ctx, args.userId, effectivePosition);
    await checkUserShiftOverlap(ctx, args.userId, shift.startTime, shift.endTime);

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

    // Build callSign→position fallback for older shifts
    const callSignPositionMap = await buildCallSignPositionMap(ctx);

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

        const position = resolveShiftPosition(shift, callSignPositionMap);

        shifts.push({
          ...shift,
          position,
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

/** Delete all unassigned shifts that don't match any active pattern (admin only) */
export const clearNonPatternUnassigned = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser || currentUser.role !== "admin") {
      throw new ConvexError({ message: "Only admins can clear shifts", code: "FORBIDDEN" });
    }

    // Build set of pattern signatures: "HH:mm|HH:mm|vehicle|callSign"
    const patterns = await ctx.db.query("shiftPatterns").collect();
    const activeSignatures = new Set<string>();
    for (const p of patterns.filter((p) => p.active)) {
      activeSignatures.add(`${p.startTime}|${p.endTime}|${p.vehicle ?? ""}|${p.callSign ?? ""}`);
    }

    // Find all unassigned shifts
    const allShifts = await ctx.db.query("shifts").collect();
    let deleted = 0;

    for (const shift of allShifts) {
      const members = await ctx.db
        .query("shiftMembers")
        .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
        .collect();
      if (members.length > 0) continue; // skip assigned shifts

      // Extract HH:mm from ISO timestamps
      const startHHmm = new Date(shift.startTime).toISOString().slice(11, 16);
      const endHHmm = new Date(shift.endTime).toISOString().slice(11, 16);
      const sig = `${startHHmm}|${endHHmm}|${shift.vehicle}|${shift.callSign ?? ""}`;

      if (!activeSignatures.has(sig)) {
        await ctx.db.delete(shift._id);
        deleted++;
      }
    }

    return deleted;
  },
});
