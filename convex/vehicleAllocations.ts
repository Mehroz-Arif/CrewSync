import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

/** Check if two HH:mm time ranges overlap (handles overnight shifts) */
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  let s1 = toMinutes(start1),
    e1 = toMinutes(end1);
  let s2 = toMinutes(start2),
    e2 = toMinutes(end2);

  // Overnight: if end <= start, wrap past midnight
  if (e1 <= s1) e1 += 24 * 60;
  if (e2 <= s2) e2 += 24 * 60;

  return s1 < e2 && s2 < e1;
}

/**
 * Get the effective HH:mm time range for a call sign on a given date.
 * Checks shift patterns first, then falls back to actual shifts on that date.
 */
async function getCallSignTimeRange(
  ctx: MutationCtx,
  callSign: string,
  date: string
): Promise<{ start: string; end: string } | null> {
  // 1) Try active shift patterns
  const patterns = await ctx.db.query("shiftPatterns").collect();
  for (const p of patterns) {
    if (p.active && p.callSign === callSign) {
      return { start: p.startTime, end: p.endTime };
    }
  }

  // 2) Fall back to actual shifts on this date with the same call sign
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const shifts = await ctx.db
    .query("shifts")
    .withIndex("by_start_time", (q) =>
      q.gte("startTime", dayStart).lte("startTime", dayEnd)
    )
    .collect();

  for (const s of shifts) {
    if (s.callSign === callSign) {
      const startHHmm = new Date(s.startTime).toISOString().slice(11, 16);
      const endHHmm = new Date(s.endTime).toISOString().slice(11, 16);
      return { start: startHHmm, end: endHHmm };
    }
  }

  return null;
}

/** Get all vehicle allocations for a date range */
export const getByDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }

    const allocations = await ctx.db
      .query("vehicleAllocations")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate)
      )
      .collect();

    return allocations;
  },
});

/** Get unique call signs from shift patterns */
export const getCallSigns = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }

    const patterns = await ctx.db.query("shiftPatterns").collect();
    const callSigns = new Set<string>();
    for (const p of patterns) {
      if (p.callSign) callSigns.add(p.callSign);
    }

    // Also check existing shifts for call signs not in patterns
    const shifts = await ctx.db.query("shifts").collect();
    for (const s of shifts) {
      if (s.callSign) callSigns.add(s.callSign);
    }

    return [...callSigns].sort();
  },
});

/** Get unique vehicles from shift patterns and shifts */
export const getVehicles = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }

    const patterns = await ctx.db.query("shiftPatterns").collect();
    const vehicles = new Set<string>();
    for (const p of patterns) {
      if (p.vehicle) vehicles.add(p.vehicle);
    }

    const shifts = await ctx.db.query("shifts").collect();
    for (const s of shifts) {
      if (s.vehicle) vehicles.add(s.vehicle);
    }

    return [...vehicles].sort();
  },
});

/** Set a vehicle allocation for a call sign on a specific date */
export const setAllocation = mutation({
  args: {
    date: v.string(),
    callSign: v.string(),
    vehicle: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can allocate vehicles", code: "FORBIDDEN" });
    }

    // Check if an allocation already exists for this date + callSign
    const existing = await ctx.db
      .query("vehicleAllocations")
      .withIndex("by_date_and_callSign", (q) =>
        q.eq("date", args.date).eq("callSign", args.callSign)
      )
      .first();

    // Check if the vehicle is already assigned to a different call sign
    // that operates during overlapping hours on this date
    const sameDateAllocations = await ctx.db
      .query("vehicleAllocations")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    const currentTimes = await getCallSignTimeRange(ctx, args.callSign, args.date);

    for (const a of sameDateAllocations) {
      if (a.vehicle !== args.vehicle || a.callSign === args.callSign) continue;

      const otherTimes = await getCallSignTimeRange(ctx, a.callSign, args.date);

      // If we can determine times for both, only block on overlap
      if (currentTimes && otherTimes) {
        if (
          !timeRangesOverlap(
            currentTimes.start,
            currentTimes.end,
            otherTimes.start,
            otherTimes.end
          )
        ) {
          continue; // Non-overlapping — allow sharing
        }
      }

      // Times overlap or unknown — block
      throw new ConvexError({
        message: `Vehicle ${args.vehicle} is already assigned to ${a.callSign} during overlapping hours on this date`,
        code: "CONFLICT",
      });
    }

    if (existing) {
      // Update existing allocation
      await ctx.db.patch(existing._id, {
        vehicle: args.vehicle,
        notes: args.notes,
      });
      return existing._id;
    }

    // Create new allocation
    return await ctx.db.insert("vehicleAllocations", {
      date: args.date,
      callSign: args.callSign,
      vehicle: args.vehicle,
      notes: args.notes,
      createdBy: user._id,
    });
  },
});

/** Remove a vehicle allocation */
export const removeAllocation = mutation({
  args: { allocationId: v.id("vehicleAllocations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can remove allocations", code: "FORBIDDEN" });
    }

    const allocation = await ctx.db.get(args.allocationId);
    if (!allocation) {
      throw new ConvexError({ message: "Allocation not found", code: "NOT_FOUND" });
    }

    await ctx.db.delete(args.allocationId);
  },
});

/** Copy allocations from one date to another (admin only) */
export const copyAllocations = mutation({
  args: { fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ message: "Only admins can copy allocations", code: "FORBIDDEN" });
    }

    const sourceAllocations = await ctx.db
      .query("vehicleAllocations")
      .withIndex("by_date", (q) => q.eq("date", args.fromDate))
      .collect();

    let created = 0;
    for (const alloc of sourceAllocations) {
      // Check if target already has an allocation for this call sign
      const existing = await ctx.db
        .query("vehicleAllocations")
        .withIndex("by_date_and_callSign", (q) =>
          q.eq("date", args.toDate).eq("callSign", alloc.callSign)
        )
        .first();

      // Check if the vehicle would conflict on the target date (time-aware)
      const targetAllocations = await ctx.db
        .query("vehicleAllocations")
        .withIndex("by_date", (q) => q.eq("date", args.toDate))
        .collect();

      const currentTimes = await getCallSignTimeRange(ctx, alloc.callSign, args.toDate);
      let hasConflict = false;

      for (const ta of targetAllocations) {
        if (ta.vehicle !== alloc.vehicle || ta.callSign === alloc.callSign) continue;

        const otherTimes = await getCallSignTimeRange(ctx, ta.callSign, args.toDate);

        if (currentTimes && otherTimes) {
          if (
            !timeRangesOverlap(
              currentTimes.start,
              currentTimes.end,
              otherTimes.start,
              otherTimes.end
            )
          ) {
            continue; // Non-overlapping — allow
          }
        }

        hasConflict = true;
        break;
      }

      if (hasConflict) {
        // Skip conflicting allocations during copy
        continue;
      }

      if (existing) {
        await ctx.db.patch(existing._id, { vehicle: alloc.vehicle, notes: alloc.notes });
      } else {
        await ctx.db.insert("vehicleAllocations", {
          date: args.toDate,
          callSign: alloc.callSign,
          vehicle: alloc.vehicle,
          notes: alloc.notes,
          createdBy: user._id,
        });
      }
      created++;
    }

    return created;
  },
});
