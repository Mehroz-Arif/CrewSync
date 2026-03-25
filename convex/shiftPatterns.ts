import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import { checkUserShiftOverlap } from "./shifts.ts";

/** List all shift patterns with enriched member names */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can view patterns", code: "FORBIDDEN" });
    }

    const patterns = await ctx.db.query("shiftPatterns").collect();

    return Promise.all(
      patterns.map(async (p) => {
        const members = await Promise.all(
          p.memberIds.map(async (uid) => {
            const u = await ctx.db.get(uid);
            return { userId: uid, name: u?.name ?? "Unknown" };
          })
        );
        return { ...p, members };
      })
    );
  },
});

/** Create a new shift pattern (weekly or rotation) */
export const create = mutation({
  args: {
    name: v.string(),
    patternType: v.union(v.literal("weekly"), v.literal("rotation")),
    // Weekly
    days: v.optional(v.array(v.number())),
    // Rotation
    daysOn: v.optional(v.number()),
    daysOff: v.optional(v.number()),
    rotationStartDate: v.optional(v.string()),
    rotationEndDate: v.optional(v.string()),
    // Shared
    startTime: v.string(),
    endTime: v.string(),
    vehicle: v.string(),
    callSign: v.optional(v.string()),
    notes: v.optional(v.string()),
    memberIds: v.array(v.id("users")),
    crewNumber: v.optional(v.number()),
    // Effective date range (optional for all pattern types)
    effectiveStartDate: v.optional(v.string()),
    effectiveEndDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can create patterns", code: "FORBIDDEN" });
    }

    if (args.patternType === "weekly") {
      if (!args.days || args.days.length === 0) {
        throw new ConvexError({ message: "Select at least one day for weekly patterns", code: "BAD_REQUEST" });
      }
    } else {
      // rotation
      if (!args.daysOn || args.daysOn < 1) {
        throw new ConvexError({ message: "Days on must be at least 1", code: "BAD_REQUEST" });
      }
      if (!args.daysOff || args.daysOff < 1) {
        throw new ConvexError({ message: "Days off must be at least 1", code: "BAD_REQUEST" });
      }
      if (!args.rotationStartDate) {
        throw new ConvexError({ message: "Rotation start date is required", code: "BAD_REQUEST" });
      }
      if (!args.rotationEndDate) {
        throw new ConvexError({ message: "Rotation end date is required", code: "BAD_REQUEST" });
      }
      if (args.rotationEndDate <= args.rotationStartDate) {
        throw new ConvexError({ message: "End date must be after start date", code: "BAD_REQUEST" });
      }
    }

    // Validate effective date range if both are provided
    if (args.effectiveStartDate && args.effectiveEndDate && args.effectiveEndDate <= args.effectiveStartDate) {
      throw new ConvexError({ message: "Effective end date must be after start date", code: "BAD_REQUEST" });
    }

    return await ctx.db.insert("shiftPatterns", {
      name: args.name,
      patternType: args.patternType,
      days: args.patternType === "weekly" ? args.days : undefined,
      daysOn: args.patternType === "rotation" ? args.daysOn : undefined,
      daysOff: args.patternType === "rotation" ? args.daysOff : undefined,
      rotationStartDate: args.patternType === "rotation" ? args.rotationStartDate : undefined,
      rotationEndDate: args.patternType === "rotation" ? args.rotationEndDate : undefined,
      effectiveStartDate: args.effectiveStartDate,
      effectiveEndDate: args.effectiveEndDate,
      startTime: args.startTime,
      endTime: args.endTime,
      vehicle: args.vehicle,
      callSign: args.callSign,
      notes: args.notes,
      memberIds: args.memberIds,
      crewNumber: args.crewNumber ?? 1,
      createdBy: user._id,
      active: true,
    });
  },
});

/** Update an existing shift pattern */
export const update = mutation({
  args: {
    patternId: v.id("shiftPatterns"),
    name: v.optional(v.string()),
    patternType: v.optional(v.union(v.literal("weekly"), v.literal("rotation"))),
    days: v.optional(v.array(v.number())),
    daysOn: v.optional(v.number()),
    daysOff: v.optional(v.number()),
    rotationStartDate: v.optional(v.string()),
    rotationEndDate: v.optional(v.string()),
    effectiveStartDate: v.optional(v.string()),
    effectiveEndDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    vehicle: v.optional(v.string()),
    callSign: v.optional(v.string()),
    notes: v.optional(v.string()),
    memberIds: v.optional(v.array(v.id("users"))),
    crewNumber: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can update patterns", code: "FORBIDDEN" });
    }

    const existing = await ctx.db.get(args.patternId);
    if (!existing) {
      throw new ConvexError({ message: "Pattern not found", code: "NOT_FOUND" });
    }

    const { patternId, ...fields } = args;
    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.patternType !== undefined) patch.patternType = fields.patternType;
    if (fields.days !== undefined) patch.days = fields.days;
    if (fields.daysOn !== undefined) patch.daysOn = fields.daysOn;
    if (fields.daysOff !== undefined) patch.daysOff = fields.daysOff;
    if (fields.rotationStartDate !== undefined) patch.rotationStartDate = fields.rotationStartDate;
    if (fields.rotationEndDate !== undefined) patch.rotationEndDate = fields.rotationEndDate;
    if (fields.effectiveStartDate !== undefined) patch.effectiveStartDate = fields.effectiveStartDate;
    if (fields.effectiveEndDate !== undefined) patch.effectiveEndDate = fields.effectiveEndDate;
    if (fields.startTime !== undefined) patch.startTime = fields.startTime;
    if (fields.endTime !== undefined) patch.endTime = fields.endTime;
    if (fields.vehicle !== undefined) patch.vehicle = fields.vehicle;
    if (fields.callSign !== undefined) patch.callSign = fields.callSign;
    if (fields.notes !== undefined) patch.notes = fields.notes;
    if (fields.memberIds !== undefined) patch.memberIds = fields.memberIds;
    if (fields.crewNumber !== undefined) patch.crewNumber = fields.crewNumber;
    if (fields.active !== undefined) patch.active = fields.active;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(patternId, patch);
    }
  },
});

/** Delete a shift pattern */
export const remove = mutation({
  args: { patternId: v.id("shiftPatterns") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can delete patterns", code: "FORBIDDEN" });
    }

    await ctx.db.delete(args.patternId);
  },
});

/** Toggle a pattern's active status */
export const toggleActive = mutation({
  args: { patternId: v.id("shiftPatterns") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can toggle patterns", code: "FORBIDDEN" });
    }

    const pattern = await ctx.db.get(args.patternId);
    if (!pattern) {
      throw new ConvexError({ message: "Pattern not found", code: "NOT_FOUND" });
    }

    await ctx.db.patch(args.patternId, { active: !pattern.active });
    return !pattern.active;
  },
});

/**
 * Determine if a given date (YYYY-MM-DD) falls within an "on" day
 * of a rotation cycle starting at rotationStartDate.
 */
function isRotationOnDay(
  dateStr: string,
  rotationStartDate: string,
  rotationEndDate: string,
  daysOn: number,
  daysOff: number
): boolean {
  const date = new Date(dateStr + "T00:00:00Z");
  const start = new Date(rotationStartDate + "T00:00:00Z");
  const end = new Date(rotationEndDate + "T00:00:00Z");

  // Outside the rotation window
  if (date < start || date > end) return false;

  const diffMs = date.getTime() - start.getTime();
  const dayIndex = Math.floor(diffMs / 86400000);
  const cycleLength = daysOn + daysOff;
  const positionInCycle = dayIndex % cycleLength;

  return positionInCycle < daysOn;
}

/**
 * Apply all active patterns to a given week, creating shifts.
 * Supports both weekly and rotation pattern types.
 * Skips duplicate shifts and members with overlaps.
 */
export const applyToWeek = mutation({
  args: { weekStartISO: v.string() },
  handler: async (ctx, args): Promise<{ created: number; skippedOverlaps: number; skippedDuplicates: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can apply patterns", code: "FORBIDDEN" });
    }

    const patterns = await ctx.db.query("shiftPatterns").collect();
    const activePatterns = patterns.filter((p) => p.active);
    if (activePatterns.length === 0) {
      throw new ConvexError({ message: "No active patterns to apply", code: "BAD_REQUEST" });
    }

    const weekStart = new Date(args.weekStartISO);
    let created = 0;
    let skippedOverlaps = 0;
    let skippedDuplicates = 0;

    for (const pattern of activePatterns) {
      // Collect which dates this pattern should generate shifts for
      const shiftDates: string[] = [];

      if (pattern.patternType === "weekly") {
        // Weekly: use ISO day-of-week mapping
        const days = pattern.days ?? [];
        for (const isoDay of days) {
          const dayOffset = isoDay - 1; // 1=Mon → offset 0
          const shiftDate = new Date(weekStart.getTime() + dayOffset * 86400000);
          const dateStr = shiftDate.toISOString().slice(0, 10);

          // Skip dates outside the effective range
          if (pattern.effectiveStartDate && dateStr < pattern.effectiveStartDate) continue;
          if (pattern.effectiveEndDate && dateStr > pattern.effectiveEndDate) continue;

          shiftDates.push(dateStr);
        }
      } else {
        // Rotation: check each day of the week
        if (!pattern.daysOn || !pattern.daysOff || !pattern.rotationStartDate || !pattern.rotationEndDate) {
          continue; // incomplete rotation config
        }
        for (let offset = 0; offset < 7; offset++) {
          const dayDate = new Date(weekStart.getTime() + offset * 86400000);
          const dateStr = dayDate.toISOString().slice(0, 10);

          // Skip dates outside the effective range
          if (pattern.effectiveStartDate && dateStr < pattern.effectiveStartDate) continue;
          if (pattern.effectiveEndDate && dateStr > pattern.effectiveEndDate) continue;

          if (
            isRotationOnDay(
              dateStr,
              pattern.rotationStartDate,
              pattern.rotationEndDate,
              pattern.daysOn,
              pattern.daysOff
            )
          ) {
            shiftDates.push(dateStr);
          }
        }
      }

      // Create shifts for each applicable date
      for (const dateStr of shiftDates) {
        const startISO = new Date(`${dateStr}T${pattern.startTime}:00`).toISOString();
        let endDate = new Date(`${dateStr}T${pattern.endTime}:00`);
        const startDate = new Date(`${dateStr}T${pattern.startTime}:00`);
        if (endDate <= startDate) {
          // Overnight shift
          endDate = new Date(endDate.getTime() + 86400000);
        }
        const endISO = endDate.toISOString();

        // Check how many matching shifts already exist for this vehicle+time
        const existingShifts = await ctx.db
          .query("shifts")
          .withIndex("by_start_time", (q) => q.eq("startTime", startISO))
          .collect();

        const matchingExisting = existingShifts.filter(
          (s) => s.endTime === endISO && s.vehicle === pattern.vehicle
        );

        const crewCount = pattern.crewNumber ?? 1;
        const shiftsToCreate = crewCount - matchingExisting.length;

        if (shiftsToCreate <= 0) {
          skippedDuplicates++;
          continue;
        }

        // Distribute members across all shifts (existing + new)
        const memberChunks: Id<"users">[][] = Array.from(
          { length: crewCount },
          () => []
        );
        pattern.memberIds.forEach((memberId, idx) => {
          memberChunks[idx % crewCount].push(memberId);
        });

        // Create the needed shifts
        for (let si = 0; si < shiftsToCreate; si++) {
          const slotIndex = matchingExisting.length + si;
          const shiftId = await ctx.db.insert("shifts", {
            startTime: startISO,
            endTime: endISO,
            vehicle: pattern.vehicle,
            callSign: pattern.callSign,
            notes: pattern.notes,
            createdBy: user._id,
          });

          // Assign the members allocated to this slot
          const slotMembers = memberChunks[slotIndex] ?? [];
          for (const memberId of slotMembers) {
            try {
              await checkUserShiftOverlap(ctx, memberId, startISO, endISO);
              await ctx.db.insert("shiftMembers", { shiftId, userId: memberId });
            } catch {
              skippedOverlaps++;
            }
          }

          created++;
        }
      }
    }

    return { created, skippedOverlaps, skippedDuplicates };
  },
});
