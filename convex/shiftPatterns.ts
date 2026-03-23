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

/** Create a new shift pattern */
export const create = mutation({
  args: {
    name: v.string(),
    days: v.array(v.number()),
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can create patterns", code: "FORBIDDEN" });
    }

    if (args.days.length === 0) {
      throw new ConvexError({ message: "Select at least one day", code: "BAD_REQUEST" });
    }

    return await ctx.db.insert("shiftPatterns", {
      name: args.name,
      days: args.days,
      startTime: args.startTime,
      endTime: args.endTime,
      vehicle: args.vehicle,
      notes: args.notes,
      memberIds: args.memberIds,
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
    days: v.optional(v.array(v.number())),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    vehicle: v.optional(v.string()),
    notes: v.optional(v.string()),
    memberIds: v.optional(v.array(v.id("users"))),
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
    if (fields.days !== undefined) {
      if (fields.days.length === 0) {
        throw new ConvexError({ message: "Select at least one day", code: "BAD_REQUEST" });
      }
      patch.days = fields.days;
    }
    if (fields.startTime !== undefined) patch.startTime = fields.startTime;
    if (fields.endTime !== undefined) patch.endTime = fields.endTime;
    if (fields.vehicle !== undefined) patch.vehicle = fields.vehicle;
    if (fields.notes !== undefined) patch.notes = fields.notes;
    if (fields.memberIds !== undefined) patch.memberIds = fields.memberIds;
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
 * Apply all active patterns to a given week, creating shifts.
 * Skips duplicate shifts (same vehicle + time) and members with overlaps.
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
      for (const isoDay of pattern.days) {
        // isoDay: 1=Mon...7=Sun → offset from Monday
        const dayOffset = isoDay - 1;
        const shiftDate = new Date(weekStart.getTime() + dayOffset * 86400000);
        const dateStr = shiftDate.toISOString().slice(0, 10); // "YYYY-MM-DD"

        // Build full ISO start/end times
        const startISO = new Date(`${dateStr}T${pattern.startTime}:00`).toISOString();
        let endDate = new Date(`${dateStr}T${pattern.endTime}:00`);
        const startDate = new Date(`${dateStr}T${pattern.startTime}:00`);
        if (endDate <= startDate) {
          // Overnight shift — push end to next day
          endDate = new Date(endDate.getTime() + 86400000);
        }
        const endISO = endDate.toISOString();

        // Duplicate check: same vehicle + same start/end on this day
        const existingShifts = await ctx.db
          .query("shifts")
          .withIndex("by_start_time", (q) => q.eq("startTime", startISO))
          .collect();

        const isDuplicate = existingShifts.some(
          (s) => s.endTime === endISO && s.vehicle === pattern.vehicle
        );

        if (isDuplicate) {
          skippedDuplicates++;
          continue;
        }

        // Create the shift
        const shiftId = await ctx.db.insert("shifts", {
          startTime: startISO,
          endTime: endISO,
          vehicle: pattern.vehicle,
          notes: pattern.notes,
          createdBy: user._id,
        });

        // Assign members, skipping those with overlaps
        for (const memberId of pattern.memberIds) {
          try {
            await checkUserShiftOverlap(ctx, memberId, startISO, endISO);
            await ctx.db.insert("shiftMembers", { shiftId, userId: memberId });
          } catch {
            // Overlap detected — skip this member for this shift
            skippedOverlaps++;
          }
        }

        created++;
      }
    }

    return { created, skippedOverlaps, skippedDuplicates };
  },
});
