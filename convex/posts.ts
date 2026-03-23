import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

/** Generate a short-lived upload URL for post images */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    category: v.union(
      v.literal("announcement"),
      v.literal("update"),
      v.literal("shoutout"),
      v.literal("general")
    ),
    pinned: v.optional(v.boolean()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }
    return await ctx.db.insert("posts", {
      authorId: user._id,
      title: args.title,
      body: args.body,
      category: args.category,
      pinned: args.pinned ?? false,
      likesCount: 0,
      imageStorageId: args.imageStorageId,
    });
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const results = await ctx.db
      .query("posts")
      .order("desc")
      .paginate(args.paginationOpts);

    const postsWithAuthors = await Promise.all(
      results.page.map(async (post) => {
        const author = await ctx.db.get(post.authorId);
        const imageUrl = post.imageStorageId
          ? await ctx.storage.getUrl(post.imageStorageId)
          : null;
        return {
          ...post,
          authorName: author?.name ?? "Unknown",
          authorAvatarUrl: author?.avatarUrl,
          authorDepartment: author?.department,
          imageUrl,
        };
      })
    );

    return {
      ...results,
      page: postsWithAuthors,
    };
  },
});

export const getPinned = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const allPosts = await ctx.db.query("posts").order("desc").collect();
    const pinned = allPosts.filter((p) => p.pinned);

    const pinnedWithAuthors = await Promise.all(
      pinned.map(async (post) => {
        const author = await ctx.db.get(post.authorId);
        const imageUrl = post.imageStorageId
          ? await ctx.storage.getUrl(post.imageStorageId)
          : null;
        return {
          ...post,
          authorName: author?.name ?? "Unknown",
          imageUrl,
        };
      })
    );

    return pinnedWithAuthors;
  },
});

export const toggleLike = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const existing = await ctx.db
      .query("postLikes")
      .withIndex("by_user_and_post", (q) =>
        q.eq("userId", user._id).eq("postId", args.postId)
      )
      .unique();

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new ConvexError({
        message: "Post not found",
        code: "NOT_FOUND",
      });
    }

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.postId, {
        likesCount: Math.max(0, post.likesCount - 1),
      });
      return false;
    } else {
      await ctx.db.insert("postLikes", {
        postId: args.postId,
        userId: user._id,
      });
      await ctx.db.patch(args.postId, {
        likesCount: post.likesCount + 1,
      });
      return true;
    }
  },
});

export const getUserLikes = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return [];

    const likes = await ctx.db
      .query("postLikes")
      .withIndex("by_post")
      .collect();

    return likes
      .filter((l) => l.userId === user._id)
      .map((l) => l.postId);
  },
});

export const deletePost = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new ConvexError({
        message: "Post not found",
        code: "NOT_FOUND",
      });
    }

    if (post.authorId !== user._id && user.role !== "admin") {
      throw new ConvexError({
        message: "Not authorized to delete this post",
        code: "FORBIDDEN",
      });
    }

    // Delete associated likes
    const likes = await ctx.db
      .query("postLikes")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .collect();
    for (const like of likes) {
      await ctx.db.delete(like._id);
    }

    // Delete stored image if present
    if (post.imageStorageId) {
      await ctx.storage.delete(post.imageStorageId);
    }

    await ctx.db.delete(args.postId);
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const totalPosts = (await ctx.db.query("posts").collect()).length;
    const totalUsers = (await ctx.db.query("users").collect()).length;
    const announcements = (await ctx.db.query("posts").collect()).filter(
      (p) => p.category === "announcement"
    ).length;
    const shoutouts = (await ctx.db.query("posts").collect()).filter(
      (p) => p.category === "shoutout"
    ).length;

    return {
      totalPosts,
      totalUsers,
      announcements,
      shoutouts,
    };
  },
});
