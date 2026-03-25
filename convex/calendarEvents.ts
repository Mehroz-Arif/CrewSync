import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";

const EVENT_TYPE_VALIDATOR = v.union(
  v.literal("training"),
  v.literal("staff_meeting"),
  v.literal("deadline"),
  v.literal("social"),
  v.literal("other")
);

/** Get all events within a date range (inclusive), including attendance data */
export const getByDateRange = query({
  args: {
    startDate: v.string(), // "YYYY-MM-DD"
    endDate: v.string(), // "YYYY-MM-DD"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate)
      )
      .collect();

    // Attach creator names + attendance counts
    const userCache = new Map<string, string>();
    return Promise.all(
      events.map(async (event) => {
        let creatorName = userCache.get(event.createdBy);
        if (!creatorName) {
          const user = await ctx.db.get(event.createdBy);
          creatorName = user?.name ?? "Unknown";
          userCache.set(event.createdBy, creatorName);
        }

        // Gather attendance data if enabled
        let attendanceCount = 0;
        let approvedCount = 0;
        if (event.attendanceEnabled) {
          const attendance = await ctx.db
            .query("eventAttendance")
            .withIndex("by_event", (q) => q.eq("eventId", event._id))
            .collect();
          attendanceCount = attendance.length;
          approvedCount = attendance.filter((a) => a.status === "approved").length;
        }

        return {
          ...event,
          creatorName,
          attendanceCount,
          approvedCount,
        };
      })
    );
  },
});

/** Create a new calendar event (admin only) */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    eventType: EVENT_TYPE_VALIDATOR,
    date: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    allDay: v.boolean(),
    location: v.optional(v.string()),
    teamsLink: v.optional(v.string()),
    attendanceEnabled: v.optional(v.boolean()),
    maxAttendees: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can create calendar events" });
    }

    // Validate time range if not all-day
    if (!args.allDay) {
      if (!args.startTime || !args.endTime) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Start and end times are required for timed events",
        });
      }
      if (args.startTime >= args.endTime) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "End time must be after start time",
        });
      }
    }

    // Validate maxAttendees
    if (args.maxAttendees !== undefined && args.maxAttendees < 1) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maximum attendees must be at least 1",
      });
    }

    return await ctx.db.insert("calendarEvents", {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      eventType: args.eventType,
      date: args.date,
      startTime: args.allDay ? undefined : args.startTime,
      endTime: args.allDay ? undefined : args.endTime,
      allDay: args.allDay,
      location: args.location?.trim() || undefined,
      teamsLink: args.teamsLink?.trim() || undefined,
      createdBy: user._id,
      attendanceEnabled: args.attendanceEnabled ?? false,
      maxAttendees: args.attendanceEnabled ? args.maxAttendees : undefined,
    });
  },
});

/** Update an existing calendar event (admin only) */
export const update = mutation({
  args: {
    eventId: v.id("calendarEvents"),
    title: v.string(),
    description: v.optional(v.string()),
    eventType: EVENT_TYPE_VALIDATOR,
    date: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    allDay: v.boolean(),
    location: v.optional(v.string()),
    teamsLink: v.optional(v.string()),
    attendanceEnabled: v.optional(v.boolean()),
    maxAttendees: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can edit calendar events" });
    }

    const existing = await ctx.db.get(args.eventId);
    if (!existing) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Event not found" });
    }

    if (!args.allDay && (!args.startTime || !args.endTime)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Start and end times are required for timed events",
      });
    }
    if (!args.allDay && args.startTime && args.endTime && args.startTime >= args.endTime) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "End time must be after start time",
      });
    }

    if (args.maxAttendees !== undefined && args.maxAttendees < 1) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maximum attendees must be at least 1",
      });
    }

    await ctx.db.patch(args.eventId, {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      eventType: args.eventType,
      date: args.date,
      startTime: args.allDay ? undefined : args.startTime,
      endTime: args.allDay ? undefined : args.endTime,
      allDay: args.allDay,
      location: args.location?.trim() || undefined,
      teamsLink: args.teamsLink?.trim() || undefined,
      attendanceEnabled: args.attendanceEnabled ?? false,
      maxAttendees: args.attendanceEnabled ? args.maxAttendees : undefined,
    });
  },
});

/** Delete a calendar event (admin only) — also removes all attendance records */
export const remove = mutation({
  args: { eventId: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can delete calendar events" });
    }

    const existing = await ctx.db.get(args.eventId);
    if (!existing) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Event not found" });
    }

    // Remove all attendance records for this event
    const attendance = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const record of attendance) {
      await ctx.db.delete(record._id);
    }

    await ctx.db.delete(args.eventId);
  },
});

// ─── Attendance Functions ────────────────────────────────────────────────────

/** Get attendance list for a specific event */
export const getAttendance = query({
  args: { eventId: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const records = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return Promise.all(
      records.map(async (record) => {
        const user = await ctx.db.get(record.userId);
        return {
          ...record,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "",
        };
      })
    );
  },
});

/** Get the current user's attendance status for an event */
export const getMyAttendance = query({
  args: { eventId: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    const record = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id)
      )
      .first();

    return record;
  },
});

/** Staff requests attendance on an event */
export const requestAttendance = mutation({
  args: { eventId: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Event not found" });
    }
    if (!event.attendanceEnabled) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Attendance is not enabled for this event" });
    }

    // Check if already requested
    const existing = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id)
      )
      .first();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: "You have already requested attendance" });
    }

    // Check capacity — count approved attendees
    if (event.maxAttendees) {
      const approved = await ctx.db
        .query("eventAttendance")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect();
      const approvedCount = approved.filter((a) => a.status === "approved").length;
      if (approvedCount >= event.maxAttendees) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "This event has reached its maximum number of attendees",
        });
      }
    }

    await ctx.db.insert("eventAttendance", {
      eventId: args.eventId,
      userId: user._id,
      status: "requested",
    });
  },
});

/** Staff cancels their own attendance request */
export const cancelAttendance = mutation({
  args: { eventId: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const record = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id)
      )
      .first();
    if (!record) {
      throw new ConvexError({ code: "NOT_FOUND", message: "No attendance request found" });
    }

    await ctx.db.delete(record._id);
  },
});

/** Admin approves or denies an attendance request */
export const updateAttendanceStatus = mutation({
  args: {
    attendanceId: v.id("eventAttendance"),
    status: v.union(v.literal("approved"), v.literal("denied")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can manage attendance" });
    }

    const record = await ctx.db.get(args.attendanceId);
    if (!record) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Attendance record not found" });
    }

    // If approving, check capacity
    if (args.status === "approved") {
      const event = await ctx.db.get(record.eventId);
      if (event?.maxAttendees) {
        const allAttendance = await ctx.db
          .query("eventAttendance")
          .withIndex("by_event", (q) => q.eq("eventId", record.eventId))
          .collect();
        const currentApproved = allAttendance.filter(
          (a) => a.status === "approved" && a._id !== args.attendanceId
        ).length;
        if (currentApproved >= event.maxAttendees) {
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: "This event has reached its maximum number of attendees",
          });
        }
      }
    }

    await ctx.db.patch(args.attendanceId, { status: args.status });
  },
});
