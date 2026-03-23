import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
    department: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  posts: defineTable({
    authorId: v.id("users"),
    title: v.string(),
    body: v.string(),
    category: v.union(
      v.literal("announcement"),
      v.literal("update"),
      v.literal("shoutout"),
      v.literal("general")
    ),
    pinned: v.boolean(),
    likesCount: v.number(),
  }).index("by_author", ["authorId"]),

  postLikes: defineTable({
    postId: v.id("posts"),
    userId: v.id("users"),
  })
    .index("by_post", ["postId"])
    .index("by_user_and_post", ["userId", "postId"]),

  conversations: defineTable({
    name: v.optional(v.string()),
    type: v.union(v.literal("direct"), v.literal("group")),
    lastMessageAt: v.optional(v.string()),
    broadcastOnly: v.optional(v.boolean()),
  }),

  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_conversation", ["conversationId"])
    .index("by_user_and_conversation", ["userId", "conversationId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    authorId: v.id("users"),
    body: v.string(),
  }).index("by_conversation", ["conversationId"]),

  shifts: defineTable({
    startTime: v.string(),
    endTime: v.string(),
    vehicle: v.string(),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_start_time", ["startTime"]),

  shiftMembers: defineTable({
    shiftId: v.id("shifts"),
    userId: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_shift", ["shiftId"]),

  availability: defineTable({
    userId: v.id("users"),
    date: v.string(),
    status: v.union(v.literal("available"), v.literal("unavailable")),
    notes: v.optional(v.string()),
  })
    .index("by_user_and_date", ["userId", "date"])
    .index("by_date", ["date"]),
});
