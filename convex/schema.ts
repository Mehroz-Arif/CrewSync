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
    isSuperAdmin: v.optional(v.boolean()),
    suspended: v.optional(v.boolean()),
    // Profile fields
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    employmentType: v.optional(v.union(v.literal("employee"), v.literal("subcontractor"))),
    jobTitle: v.optional(v.string()),
    startDate: v.optional(v.string()), // ISO date
    address: v.optional(v.string()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    certifications: v.optional(v.array(v.string())),
    hourlyRate: v.optional(v.number()),
    notes: v.optional(v.string()), // admin-only notes
  }).index("by_token", ["tokenIdentifier"]),

  organizations: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"))),
    logoStorageId: v.optional(v.id("_storage")),
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
      v.literal("general"),
      v.literal("feedback")
    ),
    pinned: v.boolean(),
    likesCount: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
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
    callSign: v.optional(v.string()),
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
    // Effective date range (applies to all pattern types)
    effectiveStartDate: v.optional(v.string()), // "YYYY-MM-DD"
    effectiveEndDate: v.optional(v.string()), // "YYYY-MM-DD"
    // Shared fields
    startTime: v.string(), // "HH:mm"
    endTime: v.string(), // "HH:mm"
    vehicle: v.string(),
    notes: v.optional(v.string()),
    memberIds: v.array(v.id("users")),
    crewNumber: v.optional(v.number()), // How many shifts to create per day (e.g. 2 = two separate shifts)
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
    // "You Said, We Did" fields
    adminResponse: v.optional(v.string()),
    published: v.optional(v.boolean()),
    publishedAt: v.optional(v.string()),
  }),

  folders: defineTable({
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    createdBy: v.id("users"),
    description: v.optional(v.string()),
  }).index("by_parent", ["parentId"]),

  calendarEvents: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    eventType: v.union(
      v.literal("training"),
      v.literal("staff_meeting"),
      v.literal("deadline"),
      v.literal("social"),
      v.literal("other")
    ),
    date: v.string(), // "YYYY-MM-DD"
    startTime: v.optional(v.string()), // "HH:mm"
    endTime: v.optional(v.string()), // "HH:mm"
    allDay: v.boolean(),
    location: v.optional(v.string()),
    teamsLink: v.optional(v.string()), // Microsoft Teams meeting URL
    createdBy: v.id("users"),
    // Attendance fields
    attendanceEnabled: v.optional(v.boolean()),
    maxAttendees: v.optional(v.number()), // null/undefined = unlimited
  }).index("by_date", ["date"]),

  eventAttendance: defineTable({
    eventId: v.id("calendarEvents"),
    userId: v.id("users"),
    status: v.union(
      v.literal("requested"),
      v.literal("approved"),
      v.literal("denied")
    ),
  })
    .index("by_event", ["eventId"])
    .index("by_event_and_user", ["eventId", "userId"])
    .index("by_user", ["userId"]),

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

  recognitions: defineTable({
    recipientId: v.id("users"),
    givenById: v.id("users"),
    title: v.string(),
    message: v.string(),
    badge: v.union(
      v.literal("star"),
      v.literal("heart"),
      v.literal("trophy"),
      v.literal("rocket"),
      v.literal("gem")
    ),
  }).index("by_recipient", ["recipientId"]),
});
