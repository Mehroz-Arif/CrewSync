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
    organizationId: v.optional(v.id("organizations")),
  }).index("by_token", ["tokenIdentifier"]),

  organizations: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
  }),

  invites: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    role: v.string(),
    status: v.union(v.literal("pending"), v.literal("accepted")),
  })
    .index("by_email", ["email"])
    .index("by_organization", ["organizationId"]),

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
    published: v.optional(v.boolean()),
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

  rewards: defineTable({
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    points: v.number(),
    message: v.string(),
    category: v.string(),
  })
    .index("by_to_user", ["toUserId"])
    .index("by_from_user", ["fromUserId"]),

  shiftPatterns: defineTable({
    name: v.string(),
    patternType: v.union(v.literal("weekly"), v.literal("rotation")),
    // Weekly pattern fields
    days: v.optional(v.array(v.number())), // 1=Mon...7=Sun (ISO weekday)
    // Rotation pattern fields (e.g. 4 on / 4 off)
    daysOn: v.optional(v.number()),
    daysOff: v.optional(v.number()),
    rotationStartDate: v.optional(v.string()), // "YYYY-MM-DD" — cycle anchor
    rotationEndDate: v.optional(v.string()), // "YYYY-MM-DD" — when to stop
    // Shared fields
    startTime: v.string(), // "HH:mm"
    endTime: v.string(), // "HH:mm"
    vehicle: v.string(),
    notes: v.optional(v.string()),
    memberIds: v.array(v.id("users")),
    createdBy: v.id("users"),
    active: v.boolean(),
  }),

  feedback: defineTable({
    message: v.string(),
    category: v.union(
      v.literal("general"),
      v.literal("scheduling"),
      v.literal("workplace"),
      v.literal("suggestion"),
      v.literal("concern")
    ),
    status: v.union(v.literal("new"), v.literal("reviewed"), v.literal("archived")),
  }),

  folders: defineTable({
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    createdBy: v.id("users"),
    description: v.optional(v.string()),
  }).index("by_parent", ["parentId"]),

  documents: defineTable({
    name: v.string(),
    folderId: v.optional(v.id("folders")),
    storageId: v.id("_storage"),
    fileType: v.string(),
    fileSize: v.number(),
    uploadedBy: v.id("users"),
    description: v.optional(v.string()),
  })
    .index("by_folder", ["folderId"])
    .searchIndex("search_name", {
      searchField: "name",
    }),
});
