import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";

/** List all team members (for starting new conversations) */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }
    const allUsers = await ctx.db.query("users").collect();
    // Exclude the current user from the list
    return allUsers
      .filter((u) => u._id !== currentUser._id)
      .map((u) => ({ _id: u._id, name: u.name ?? "Unknown", email: u.email, avatarUrl: u.avatarUrl }));
  },
});

/** List conversations for the current user, sorted by most recent message */
export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Get all conversation memberships for this user
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    // Fetch each conversation + members + last message
    const conversations = await Promise.all(
      memberships.map(async (m) => {
        const convo = await ctx.db.get(m.conversationId);
        if (!convo) return null;

        // Get all members
        const members = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation", (q) => q.eq("conversationId", convo._id))
          .collect();

        const memberUsers = await Promise.all(
          members.map(async (mem) => {
            const u = await ctx.db.get(mem.userId);
            return u ? { _id: u._id, name: u.name ?? "Unknown", avatarUrl: u.avatarUrl } : null;
          })
        );

        // Get last message
        const lastMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", convo._id))
          .order("desc")
          .take(1);

        const lastMessage = lastMessages[0] ?? null;
        let lastMessagePreview: string | null = null;
        let lastMessageAuthorName: string | null = null;
        if (lastMessage) {
          lastMessagePreview = lastMessage.body.length > 60
            ? lastMessage.body.slice(0, 60) + "..."
            : lastMessage.body;
          const author = await ctx.db.get(lastMessage.authorId);
          lastMessageAuthorName = author?.name ?? "Unknown";
        }

        // Build display name for direct convos
        const otherMembers = memberUsers.filter((u) => u && u._id !== currentUser._id);
        const displayName =
          convo.type === "direct"
            ? otherMembers[0]?.name ?? "Unknown"
            : convo.name ?? otherMembers.map((u) => u?.name).join(", ");

        const displayAvatar =
          convo.type === "direct" ? otherMembers[0]?.avatarUrl : undefined;

        return {
          _id: convo._id,
          type: convo.type,
          name: displayName,
          avatarUrl: displayAvatar,
          memberCount: members.length,
          lastMessagePreview,
          lastMessageAuthorName,
          lastMessageAt: convo.lastMessageAt ?? null,
          lastMessageTime: lastMessage?._creationTime ?? convo._creationTime,
        };
      })
    );

    // Filter nulls and sort by most recent activity
    return conversations
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  },
});

/** Get messages for a conversation */
export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Verify user is a member
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_and_conversation", (q) =>
        q.eq("userId", currentUser._id).eq("conversationId", args.conversationId)
      )
      .unique();
    if (!membership) {
      throw new ConvexError({ message: "Not a member of this conversation", code: "FORBIDDEN" });
    }

    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();

    return await Promise.all(
      msgs.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        return {
          _id: msg._id,
          body: msg.body,
          authorId: msg.authorId,
          authorName: author?.name ?? "Unknown",
          authorAvatarUrl: author?.avatarUrl,
          isCurrentUser: msg.authorId === currentUser._id,
          createdAt: msg._creationTime,
        };
      })
    );
  },
});

/** Send a message */
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Verify membership
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_and_conversation", (q) =>
        q.eq("userId", currentUser._id).eq("conversationId", args.conversationId)
      )
      .unique();
    if (!membership) {
      throw new ConvexError({ message: "Not a member of this conversation", code: "FORBIDDEN" });
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      authorId: currentUser._id,
      body: args.body.trim(),
    });

    // Update conversation's lastMessageAt
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: new Date().toISOString(),
    });

    return messageId;
  },
});

/** Start a new direct conversation or return existing one */
export const startDirect = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    if (currentUser._id === args.otherUserId) {
      throw new ConvexError({ message: "Cannot message yourself", code: "BAD_REQUEST" });
    }

    // Check if a direct conversation already exists between these two users
    const myMemberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    for (const mem of myMemberships) {
      const convo = await ctx.db.get(mem.conversationId);
      if (convo && convo.type === "direct") {
        const otherMembership = await ctx.db
          .query("conversationMembers")
          .withIndex("by_user_and_conversation", (q) =>
            q.eq("userId", args.otherUserId).eq("conversationId", convo._id)
          )
          .unique();
        if (otherMembership) {
          return convo._id;
        }
      }
    }

    // Create new direct conversation
    const conversationId = await ctx.db.insert("conversations", {
      type: "direct",
    });

    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: currentUser._id,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: args.otherUserId,
    });

    return conversationId;
  },
});

/** Create a group conversation */
export const createGroup = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    if (args.memberIds.length === 0) {
      throw new ConvexError({ message: "Must include at least one other member", code: "BAD_REQUEST" });
    }

    const conversationId = await ctx.db.insert("conversations", {
      type: "group",
      name: args.name.trim(),
    });

    // Add creator
    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: currentUser._id,
    });

    // Add other members
    for (const memberId of args.memberIds) {
      if (memberId !== currentUser._id) {
        await ctx.db.insert("conversationMembers", {
          conversationId,
          userId: memberId,
        });
      }
    }

    return conversationId;
  },
});

/** Get conversation details */
export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    const convo = await ctx.db.get(args.conversationId);
    if (!convo) {
      throw new ConvexError({ message: "Conversation not found", code: "NOT_FOUND" });
    }

    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", convo._id))
      .collect();

    const memberUsers = await Promise.all(
      members.map(async (mem) => {
        const u = await ctx.db.get(mem.userId);
        return u ? { _id: u._id, name: u.name ?? "Unknown", avatarUrl: u.avatarUrl } : null;
      })
    );

    const otherMembers = memberUsers.filter((u) => u && u._id !== currentUser._id);
    const displayName =
      convo.type === "direct"
        ? otherMembers[0]?.name ?? "Unknown"
        : convo.name ?? otherMembers.map((u) => u?.name).join(", ");

    return {
      _id: convo._id,
      type: convo.type,
      name: displayName,
      members: memberUsers.filter((u): u is NonNullable<typeof u> => u !== null),
    };
  },
});
