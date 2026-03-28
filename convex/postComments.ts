import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Add a comment (or reply) to a post */
export const addComment = mutation({
  args: {
    postId: v.id("posts"),
    body: v.string(),
    parentId: v.optional(v.id("postComments")),
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

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new ConvexError({ message: "Post not found", code: "NOT_FOUND" });
    }

    // If this is a reply, verify the parent comment exists and belongs to the same post
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.postId !== args.postId) {
        throw new ConvexError({ message: "Parent comment not found", code: "NOT_FOUND" });
      }
    }

    const commentId = await ctx.db.insert("postComments", {
      postId: args.postId,
      authorId: user._id,
      body: args.body,
      parentId: args.parentId,
      likesCount: 0,
    });

    // Increment post comment count
    await ctx.db.patch(args.postId, {
      commentsCount: (post.commentsCount ?? 0) + 1,
    });

    return commentId;
  },
});

/** Get all comments for a post (top-level and replies) */
export const getByPost = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const comments = await ctx.db
      .query("postComments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .order("asc")
      .collect();

    // Enrich with author info
    const enriched = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        return {
          ...comment,
          authorName: author?.name ?? "Unknown",
          authorAvatarUrl: author?.avatarUrl,
        };
      })
    );

    return enriched;
  },
});

/** Delete a comment (owner or admin only) */
export const deleteComment = mutation({
  args: { commentId: v.id("postComments") },
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

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError({ message: "Comment not found", code: "NOT_FOUND" });
    }

    if (comment.authorId !== user._id && user.role !== "admin") {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }

    // Count this comment plus its child replies for decrementing post count
    const childReplies = await ctx.db
      .query("postComments")
      .withIndex("by_parent", (q) => q.eq("parentId", args.commentId))
      .collect();

    const totalDeleted = 1 + childReplies.length;

    // Delete child reply likes
    for (const reply of childReplies) {
      const replyLikes = await ctx.db
        .query("postCommentLikes")
        .withIndex("by_comment", (q) => q.eq("commentId", reply._id))
        .collect();
      for (const like of replyLikes) {
        await ctx.db.delete(like._id);
      }
      await ctx.db.delete(reply._id);
    }

    // Delete this comment's likes
    const commentLikes = await ctx.db
      .query("postCommentLikes")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();
    for (const like of commentLikes) {
      await ctx.db.delete(like._id);
    }

    await ctx.db.delete(args.commentId);

    // Decrement post comment count
    const post = await ctx.db.get(comment.postId);
    if (post) {
      await ctx.db.patch(comment.postId, {
        commentsCount: Math.max(0, (post.commentsCount ?? 0) - totalDeleted),
      });
    }
  },
});

/** Toggle heart reaction on a comment */
export const toggleLike = mutation({
  args: { commentId: v.id("postComments") },
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

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError({ message: "Comment not found", code: "NOT_FOUND" });
    }

    const existing = await ctx.db
      .query("postCommentLikes")
      .withIndex("by_user_and_comment", (q) =>
        q.eq("userId", user._id).eq("commentId", args.commentId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.commentId, {
        likesCount: Math.max(0, comment.likesCount - 1),
      });
      return false;
    } else {
      await ctx.db.insert("postCommentLikes", {
        commentId: args.commentId,
        userId: user._id,
      });
      await ctx.db.patch(args.commentId, {
        likesCount: comment.likesCount + 1,
      });
      return true;
    }
  },
});

/** Get comment IDs that the current user has liked for a given post */
export const getUserLikesByPost = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    // Get all comments for this post
    const comments = await ctx.db
      .query("postComments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .collect();

    const commentIds = comments.map((c) => c._id);

    // Check which ones the user has liked
    const likedIds: string[] = [];
    for (const cId of commentIds) {
      const like = await ctx.db
        .query("postCommentLikes")
        .withIndex("by_user_and_comment", (q) =>
          q.eq("userId", user._id).eq("commentId", cId)
        )
        .unique();
      if (like) likedIds.push(cId);
    }

    return likedIds;
  },
});
