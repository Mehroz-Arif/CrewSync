import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";

/** Get current user's availability entries for a date range */
export const getByDateRange = query({
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

    const entries = await ctx.db
      .query("availability")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).gte("date", args.startDate).lt("date", args.endDate)
      )
      .collect();

    return entries;
  },
});

/** Get all staff availability for a date range (admin) */
export const getAllByDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const entries = await ctx.db
      .query("availability")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lt("date", args.endDate)
      )
      .collect();

    return entries;
  },
});

/** Add an availability entry for a specific date (supports multiple per day) */
export const add = mutation({
  args: {
    date: v.string(),
    status: v.union(v.literal("available"), v.literal("unavailable")),
    allDay: v.boolean(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    notes: v.optional(v.string()),
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
    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Validate time range when not all-day
    if (!args.allDay) {
      if (!args.startTime || !args.endTime) {
        throw new ConvexError({
          message: "Start time and end time are required for timed availability",
          code: "BAD_REQUEST",
        });
      }
      if (args.startTime >= args.endTime) {
        throw new ConvexError({
          message: "Start time must be before end time",
          code: "BAD_REQUEST",
        });
      }
    }

    return await ctx.db.insert("availability", {
      userId: user._id,
      date: args.date,
      status: args.status,
      allDay: args.allDay,
      startTime: args.allDay ? undefined : args.startTime,
      endTime: args.allDay ? undefined : args.endTime,
      notes: args.notes,
    });
  },
});

/** Legacy: Set availability for a specific date (upserts all-day entry, kept for backward compat) */
export const set = mutation({
  args: {
    date: v.string(),
    status: v.union(v.literal("available"), v.literal("unavailable")),
    notes: v.optional(v.string()),
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
    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Check if an all-day entry already exists for this date
    const allEntries = await ctx.db
      .query("availability")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .collect();

    const existing = allEntries.find((e) => e.allDay === true || e.allDay === undefined);

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        notes: args.notes,
        allDay: true,
      });
      return existing._id;
    }

    return await ctx.db.insert("availability", {
      userId: user._id,
      date: args.date,
      status: args.status,
      allDay: true,
      notes: args.notes,
    });
  },
});

/** Update an existing availability entry */
export const update = mutation({
  args: {
    id: v.id("availability"),
    status: v.optional(v.union(v.literal("available"), v.literal("unavailable"))),
    allDay: v.optional(v.boolean()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    notes: v.optional(v.string()),
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
    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== user._id) {
      throw new ConvexError({ message: "Entry not found", code: "NOT_FOUND" });
    }

    const updates: Record<string, unknown> = {};
    if (args.status !== undefined) updates.status = args.status;
    if (args.notes !== undefined) updates.notes = args.notes;

    if (args.allDay !== undefined) {
      updates.allDay = args.allDay;
      if (args.allDay) {
        updates.startTime = undefined;
        updates.endTime = undefined;
      }
    }

    if (args.startTime !== undefined) updates.startTime = args.startTime;
    if (args.endTime !== undefined) updates.endTime = args.endTime;

    await ctx.db.patch(args.id, updates);
  },
});

/** Remove a specific availability entry */
export const remove = mutation({
  args: { id: v.id("availability") },
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

    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== user._id) {
      throw new ConvexError({ message: "Entry not found", code: "NOT_FOUND" });
    }

    await ctx.db.delete(args.id);
  },
});

/** Admin: update an existing availability entry */
export const adminUpdate = mutation({
  args: {
    id: v.id("availability"),
    status: v.union(v.literal("available"), v.literal("unavailable")),
    allDay: v.boolean(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    }
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin || admin.role !== "admin") {
      throw new ConvexError({ message: "Only admins can update availability", code: "FORBIDDEN" });
    }

    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new ConvexError({ message: "Entry not found", code: "NOT_FOUND" });
    }

    if (!args.allDay) {
      if (!args.startTime || !args.endTime) {
        throw new ConvexError({
          message: "Start time and end time are required for timed availability",
          code: "BAD_REQUEST",
        });
      }
      if (args.startTime >= args.endTime) {
        throw new ConvexError({
          message: "Start time must be before end time",
          code: "BAD_REQUEST",
        });
      }
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      allDay: args.allDay,
      startTime: args.allDay ? undefined : args.startTime,
      endTime: args.allDay ? undefined : args.endTime,
      notes: args.notes,
    });
  },
});

/** Admin: delete an availability entry */
export const adminDelete = mutation({
  args: { id: v.id("availability") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    }
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!admin || admin.role !== "admin") {
      throw new ConvexError({ message: "Only admins can delete availability", code: "FORBIDDEN" });
    }

    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new ConvexError({ message: "Entry not found", code: "NOT_FOUND" });
    }

    await ctx.db.delete(args.id);
  },
});

/** Clear all availability entries for a specific date */
export const clear = mutation({
  args: { date: v.string() },
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

    const entries = await ctx.db
      .query("availability")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .collect();

    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }
  },
});
