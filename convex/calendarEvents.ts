import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";

const EVENT_TYPE_VALIDATOR = v.union(
  v.literal("training"),
  v.literal("staff_meeting"),
  v.literal("deadline"),
  v.literal("social"),
  v.literal("other")
);

/** Get all events within a date range (inclusive) */
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

    // Attach creator names
    const userCache = new Map<string, string>();
    return Promise.all(
      events.map(async (event) => {
        let creatorName = userCache.get(event.createdBy);
        if (!creatorName) {
          const user = await ctx.db.get(event.createdBy);
          creatorName = user?.name ?? "Unknown";
          userCache.set(event.createdBy, creatorName);
        }
        return { ...event, creatorName };
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

    return await ctx.db.insert("calendarEvents", {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      eventType: args.eventType,
      date: args.date,
      startTime: args.allDay ? undefined : args.startTime,
      endTime: args.allDay ? undefined : args.endTime,
      allDay: args.allDay,
      location: args.location?.trim() || undefined,
      createdBy: user._id,
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

    await ctx.db.patch(args.eventId, {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      eventType: args.eventType,
      date: args.date,
      startTime: args.allDay ? undefined : args.startTime,
      endTime: args.allDay ? undefined : args.endTime,
      allDay: args.allDay,
      location: args.location?.trim() || undefined,
    });
  },
});

/** Delete a calendar event (admin only) */
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

    await ctx.db.delete(args.eventId);
  },
});
