import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// ─── Helpers ────────────────────────────────────────────────

/** Compute worked minutes between two ISO timestamps minus break */
function computeWorkedMinutes(clockIn: string, clockOut: string, breakMinutes: number): number {
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const totalMinutes = Math.max(0, Math.round(diff / 60000) - breakMinutes);
  return totalMinutes;
}

// ─── Time Entry Queries ─────────────────────────────────────

/** Get the user's active (clocked-in) entry for today */
export const getActiveEntry = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return entries.find((e) => e.status === "active") ?? null;
  },
});

/** Get time entries for a user within a date range */
export const getEntriesByDateRange = query({
  args: {
    userId: v.optional(v.id("users")),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    // Staff can only see their own; admins can see anyone's
    const targetUserId = args.userId && user.role === "admin" ? args.userId : user._id;

    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", targetUserId).gte("date", args.startDate).lte("date", args.endDate)
      )
      .collect();

    return entries;
  },
});

/** Get all time entries for a date range (admin only) */
export const getAllEntriesByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") return [];

    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate)
      )
      .collect();

    // Enrich with user data
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const entryUser = await ctx.db.get(entry.userId);
        return {
          ...entry,
          userName: entryUser?.name ?? "Unknown",
          userRole: entryUser?.role,
        };
      })
    );

    return enriched;
  },
});

// ─── Time Entry Mutations ───────────────────────────────────

/** Clock in — creates a new active time entry */
export const clockIn = mutation({
  args: {
    shiftId: v.optional(v.id("shifts")),
    notes: v.optional(v.string()),
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

    // Check for existing active entry
    const existing = await ctx.db
      .query("timeEntries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const activeEntry = existing.find((e) => e.status === "active");
    if (activeEntry) {
      throw new ConvexError({
        message: "You are already clocked in. Please clock out first.",
        code: "CONFLICT",
      });
    }

    const now = new Date().toISOString();
    const date = now.slice(0, 10); // "YYYY-MM-DD"

    return await ctx.db.insert("timeEntries", {
      userId: user._id,
      shiftId: args.shiftId,
      date,
      clockIn: now,
      breakMinutes: 0,
      notes: args.notes,
      status: "active",
    });
  },
});

/** Clock out — completes the active time entry */
export const clockOut = mutation({
  args: {
    entryId: v.id("timeEntries"),
    breakMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
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

    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.userId !== user._id) {
      throw new ConvexError({ message: "Time entry not found", code: "NOT_FOUND" });
    }
    if (entry.status !== "active") {
      throw new ConvexError({ message: "This entry is not active", code: "BAD_REQUEST" });
    }

    const now = new Date().toISOString();

    await ctx.db.patch(args.entryId, {
      clockOut: now,
      breakMinutes: args.breakMinutes ?? entry.breakMinutes,
      notes: args.notes ?? entry.notes,
      status: "completed",
    });
  },
});

/** Admin: edit a time entry */
export const editEntry = mutation({
  args: {
    entryId: v.id("timeEntries"),
    clockIn: v.optional(v.string()),
    clockOut: v.optional(v.string()),
    breakMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
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
      throw new ConvexError({ message: "Only admins can edit time entries", code: "FORBIDDEN" });
    }

    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new ConvexError({ message: "Time entry not found", code: "NOT_FOUND" });
    }

    const patch: Record<string, unknown> = { status: "edited" as const };
    if (args.clockIn !== undefined) patch.clockIn = args.clockIn;
    if (args.clockOut !== undefined) patch.clockOut = args.clockOut;
    if (args.breakMinutes !== undefined) patch.breakMinutes = args.breakMinutes;
    if (args.notes !== undefined) patch.notes = args.notes;

    await ctx.db.patch(args.entryId, patch);
  },
});

/** Admin: create a manual time entry for a user */
export const createManualEntry = mutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    clockIn: v.string(),
    clockOut: v.string(),
    breakMinutes: v.number(),
    notes: v.optional(v.string()),
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
      throw new ConvexError({ message: "Only admins can create manual entries", code: "FORBIDDEN" });
    }

    return await ctx.db.insert("timeEntries", {
      userId: args.userId,
      date: args.date,
      clockIn: args.clockIn,
      clockOut: args.clockOut,
      breakMinutes: args.breakMinutes,
      notes: args.notes,
      status: "edited",
    });
  },
});

/** Delete a time entry */
export const deleteEntry = mutation({
  args: { entryId: v.id("timeEntries") },
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
      throw new ConvexError({ message: "Only admins can delete time entries", code: "FORBIDDEN" });
    }

    await ctx.db.delete(args.entryId);
  },
});

// ─── Timesheet Summary ─────────────────────────────────────

/** Compute scheduled minutes from shift start/end times */
function computeScheduledMinutes(startTime: string, endTime: string): number {
  const diff = new Date(endTime).getTime() - new Date(startTime).getTime();
  return Math.max(0, Math.round(diff / 60000));
}

/** Admin: get timesheet summary for all staff in a date range */
export const getTimesheetSummary = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser || currentUser.role !== "admin") return [];

    // Get all staff in same org (include users without an org set, as they
    // may simply not have been assigned one yet but still work shifts)
    const allUsers = await ctx.db.query("users").collect();
    const orgUsers = allUsers.filter((u) => {
      if (u.suspended) return false;
      return (
        u.organizationId === currentUser.organizationId || !u.organizationId
      );
    });

    const summaries = [];

    for (const user of orgUsers) {
      // Get shifts assigned to this user in the date range
      const memberships = await ctx.db
        .query("shiftMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      let shiftCount = 0;
      let scheduledMinutes = 0;
      let earliestDate: string | null = null;
      let latestDate: string | null = null;
      const positionSet = new Set<string>();
      const locationSet = new Set<string>();

      for (const mem of memberships) {
        const shift = await ctx.db.get(mem.shiftId);
        if (!shift) continue;

        // Check if shift falls within date range
        const shiftDate = shift.startTime.slice(0, 10);
        if (shiftDate < args.startDate || shiftDate > args.endDate) continue;

        shiftCount++;
        scheduledMinutes += computeScheduledMinutes(shift.startTime, shift.endTime);

        if (!earliestDate || shiftDate < earliestDate) earliestDate = shiftDate;
        if (!latestDate || shiftDate > latestDate) latestDate = shiftDate;

        if (shift.position) positionSet.add(shift.position);
        if (shift.callSign) locationSet.add(shift.callSign);
        else if (shift.vehicle) locationSet.add(shift.vehicle);
      }

      // Get time entries for this user in date range
      const entries = await ctx.db
        .query("timeEntries")
        .withIndex("by_user_and_date", (q) =>
          q.eq("userId", user._id).gte("date", args.startDate).lte("date", args.endDate)
        )
        .collect();

      let actualMinutes = 0;
      for (const entry of entries) {
        if (entry.clockOut) {
          actualMinutes += computeWorkedMinutes(entry.clockIn, entry.clockOut, entry.breakMinutes);
        }
      }

      // Skip users with no shifts and no time entries in the range
      if (shiftCount === 0 && entries.length === 0) continue;

      // Fallback positions from user profile
      if (positionSet.size === 0 && user.positions && user.positions.length > 0) {
        for (const p of user.positions) positionSet.add(p);
      }

      const hourlyRate = user.hourlyRate ?? 0;
      const scheduledHours = scheduledMinutes / 60;
      const actualHours = actualMinutes / 60;

      summaries.push({
        userId: user._id,
        userName: user.name ?? "Unknown",
        employmentType: user.employmentType ?? "employee",
        shiftCount,
        positions: [...positionSet],
        locations: [...locationSet],
        dateFrom: earliestDate,
        dateTo: latestDate,
        scheduledHours: Math.round(scheduledHours * 100) / 100,
        actualHours: Math.round(actualHours * 100) / 100,
        hourlyRate,
        scheduledPay: Math.round(hourlyRate * scheduledHours * 100) / 100,
        actualPay: Math.round(hourlyRate * actualHours * 100) / 100,
      });
    }

    // Sort by name
    summaries.sort((a, b) => a.userName.localeCompare(b.userName));
    return summaries;
  },
});

// ─── Weekly Timesheet Report ──────────────────────────────

/** Admin: get detailed weekly timesheet report with per-day start/end/hours */
export const getWeeklyTimesheetReport = query({
  args: {
    startDate: v.string(), // "YYYY-MM-DD" (Monday)
    endDate: v.string(), // "YYYY-MM-DD" (Sunday)
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser || currentUser.role !== "admin") return [];

    // Get all non-suspended users
    const allUsers = await ctx.db.query("users").collect();
    const orgUsers = allUsers.filter((u) => {
      if (u.suspended) return false;
      return u.organizationId === currentUser.organizationId || !u.organizationId;
    });

    // Get all time entries for the period
    const allEntries = await ctx.db
      .query("timeEntries")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate)
      )
      .collect();

    // Get all timesheets for the period
    const allTimesheets = await ctx.db.query("timesheets").collect();
    const periodTimesheets = allTimesheets.filter(
      (ts) => ts.periodStart === args.startDate
    );

    // Build report rows
    type DayEntry = {
      entryId: Id<"timeEntries">;
      start: string; // "HH:mm"
      end: string | null; // "HH:mm" or null if still active
      hours: number;
      status: "active" | "completed" | "edited";
    };

    const rows: Array<{
      userId: Id<"users">;
      userName: string;
      positions: string[];
      days: Record<string, DayEntry[]>; // "YYYY-MM-DD" → entries
      totalHours: number;
      timesheetStatus: "none" | "draft" | "submitted" | "approved" | "rejected";
      timesheetId: Id<"timesheets"> | null;
    }> = [];

    for (const user of orgUsers) {
      const userEntries = allEntries.filter((e) => e.userId === user._id);
      if (userEntries.length === 0) continue; // Skip users with no entries

      const days: Record<string, DayEntry[]> = {};
      let totalMinutes = 0;

      for (const entry of userEntries) {
        if (!days[entry.date]) days[entry.date] = [];

        const clockInDate = new Date(entry.clockIn);
        const startStr = `${String(clockInDate.getHours()).padStart(2, "0")}:${String(clockInDate.getMinutes()).padStart(2, "0")}`;

        let endStr: string | null = null;
        let hours = 0;

        if (entry.clockOut) {
          const clockOutDate = new Date(entry.clockOut);
          endStr = `${String(clockOutDate.getHours()).padStart(2, "0")}:${String(clockOutDate.getMinutes()).padStart(2, "0")}`;
          const workedMins = computeWorkedMinutes(entry.clockIn, entry.clockOut, entry.breakMinutes);
          hours = Math.round((workedMins / 60) * 100) / 100;
          totalMinutes += workedMins;
        }

        days[entry.date].push({
          entryId: entry._id,
          start: startStr,
          end: endStr,
          hours,
          status: entry.status,
        });
      }

      // Find timesheet for this user in this period
      const ts = periodTimesheets.find((t) => t.userId === user._id);

      rows.push({
        userId: user._id,
        userName: user.name ?? "Unknown",
        positions: user.positions ?? [],
        days,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        timesheetStatus: ts ? ts.status : "none",
        timesheetId: ts ? ts._id : null,
      });
    }

    rows.sort((a, b) => a.userName.localeCompare(b.userName));
    return rows;
  },
});

// ─── Timesheet Queries ──────────────────────────────────────

/** Get the user's timesheet for a specific week */
export const getMyTimesheet = query({
  args: { periodStart: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    return await ctx.db
      .query("timesheets")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", user._id).eq("periodStart", args.periodStart)
      )
      .unique();
  },
});

/** Get all timesheets (admin) optionally filtered by status */
export const getAllTimesheets = query({
  args: {
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected")
    )),
    periodStart: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") return [];

    let timesheets;
    if (args.status) {
      timesheets = await ctx.db
        .query("timesheets")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      timesheets = await ctx.db.query("timesheets").collect();
    }

    // Filter by period if specified
    if (args.periodStart) {
      timesheets = timesheets.filter((t) => t.periodStart === args.periodStart);
    }

    // Enrich with user data and reviewer data
    const enriched = await Promise.all(
      timesheets.map(async (ts) => {
        const tsUser = await ctx.db.get(ts.userId);
        const reviewer = ts.reviewedBy ? await ctx.db.get(ts.reviewedBy) : null;
        return {
          ...ts,
          userName: tsUser?.name ?? "Unknown",
          userRole: tsUser?.role,
          reviewerName: reviewer?.name ?? undefined,
        };
      })
    );

    return enriched;
  },
});

// ─── Timesheet Mutations ────────────────────────────────────

/** Submit a weekly timesheet for approval */
export const submitTimesheet = mutation({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
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

    // Check for existing timesheet for this period
    const existing = await ctx.db
      .query("timesheets")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", user._id).eq("periodStart", args.periodStart)
      )
      .unique();

    if (existing && (existing.status === "submitted" || existing.status === "approved")) {
      throw new ConvexError({
        message: `Timesheet already ${existing.status}`,
        code: "CONFLICT",
      });
    }

    // Calculate total minutes from time entries in this period
    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).gte("date", args.periodStart).lte("date", args.periodEnd)
      )
      .collect();

    let totalMinutes = 0;
    for (const entry of entries) {
      if (entry.clockOut) {
        totalMinutes += computeWorkedMinutes(entry.clockIn, entry.clockOut, entry.breakMinutes);
      }
    }

    const now = new Date().toISOString();

    if (existing) {
      // Re-submit a rejected timesheet
      await ctx.db.patch(existing._id, {
        totalMinutes,
        status: "submitted",
        submittedAt: now,
        reviewedBy: undefined,
        reviewedAt: undefined,
        reviewNotes: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("timesheets", {
      userId: user._id,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      totalMinutes,
      status: "submitted",
      submittedAt: now,
    });
  },
});

/** Admin: approve or reject a timesheet */
export const reviewTimesheet = mutation({
  args: {
    timesheetId: v.id("timesheets"),
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
      throw new ConvexError({ message: "Only admins can review timesheets", code: "FORBIDDEN" });
    }

    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet) {
      throw new ConvexError({ message: "Timesheet not found", code: "NOT_FOUND" });
    }
    if (timesheet.status !== "submitted") {
      throw new ConvexError({ message: "Can only review submitted timesheets", code: "BAD_REQUEST" });
    }

    await ctx.db.patch(args.timesheetId, {
      status: args.decision,
      reviewedBy: user._id,
      reviewedAt: new Date().toISOString(),
      reviewNotes: args.reviewNotes,
    });
  },
});
