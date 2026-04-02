import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// ── Folders ──────────────────────────────────────────────────────────

export const getFolders = query({
  args: { parentId: v.optional(v.id("folders")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    return await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
  },
});

export const getFolder = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    return await ctx.db.get(args.folderId);
  },
});

/** Build the full breadcrumb path for a folder */
export const getFolderPath = query({
  args: { folderId: v.optional(v.id("folders")) },
  handler: async (ctx, args): Promise<Array<{ _id: Id<"folders">; name: string }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    if (!args.folderId) return [];

    const path: Array<{ _id: Id<"folders">; name: string }> = [];
    let currentId: Id<"folders"> | undefined = args.folderId;
    let depth = 0;

    while (currentId && depth < 20) {
      const folder: { _id: Id<"folders">; name: string; parentId?: Id<"folders"> } | null = await ctx.db.get(currentId);
      if (!folder) break;
      path.unshift({ _id: folder._id, name: folder.name });
      currentId = folder.parentId;
      depth++;
    }

    return path;
  },
});

export const createFolder = mutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can create folders" });

    return await ctx.db.insert("folders", {
      name: args.name,
      parentId: args.parentId,
      createdBy: user._id,
      description: args.description,
    });
  },
});

export const renameFolder = mutation({
  args: { folderId: v.id("folders"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can rename folders" });

    await ctx.db.patch(args.folderId, { name: args.name });
  },
});

export const deleteFolder = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can delete folders" });

    // Delete all documents in this folder
    const docs = await ctx.db.query("documents").withIndex("by_folder", (q) => q.eq("folderId", args.folderId)).collect();
    for (const doc of docs) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(doc._id);
    }

    // Delete child folders and their documents
    const children = await ctx.db.query("folders").withIndex("by_parent", (q) => q.eq("parentId", args.folderId)).collect();
    for (const child of children) {
      const childDocs = await ctx.db.query("documents").withIndex("by_folder", (q) => q.eq("folderId", child._id)).collect();
      for (const cd of childDocs) {
        await ctx.storage.delete(cd.storageId);
        await ctx.db.delete(cd._id);
      }
      await ctx.db.delete(child._id);
    }

    await ctx.db.delete(args.folderId);
  },
});

// ── Documents ────────────────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    return await ctx.storage.generateUploadUrl();
  },
});

export const getDocuments = query({
  args: { folderId: v.optional(v.id("folders")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    return await Promise.all(
      docs.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        const uploader = await ctx.db.get(doc.uploadedBy);
        return {
          ...doc,
          url,
          uploaderName: uploader?.name ?? "Unknown",
        };
      }),
    );
  },
});

export const searchDocuments = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    if (!args.query.trim()) return [];

    const docs = await ctx.db
      .query("documents")
      .withSearchIndex("search_name", (q) => q.search("name", args.query))
      .take(20);

    return await Promise.all(
      docs.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        const uploader = await ctx.db.get(doc.uploadedBy);
        const folder = doc.folderId ? await ctx.db.get(doc.folderId) : null;
        return {
          ...doc,
          url,
          uploaderName: uploader?.name ?? "Unknown",
          folderName: folder?.name ?? null,
        };
      }),
    );
  },
});

export const uploadDocument = mutation({
  args: {
    name: v.string(),
    folderId: v.optional(v.id("folders")),
    storageId: v.id("_storage"),
    fileType: v.string(),
    fileSize: v.number(),
    description: v.optional(v.string()),
    publishToFeed: v.optional(v.boolean()),
    feedTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can upload documents" });

    const docId = await ctx.db.insert("documents", {
      name: args.name,
      folderId: args.folderId,
      storageId: args.storageId,
      fileType: args.fileType,
      fileSize: args.fileSize,
      uploadedBy: user._id,
      description: args.description,
    });

    // Optionally publish an announcement to the news feed
    if (args.publishToFeed) {
      await ctx.db.insert("posts", {
        authorId: user._id,
        title: args.feedTitle?.trim() || `New document: ${args.name}`,
        body: args.description?.trim() || `A new document "${args.name}" has been uploaded and is now available in Documents.`,
        category: "announcement",
        pinned: false,
        likesCount: 0,
        commentsEnabled: true,
        documentId: docId,
      });
    }

    return docId;
  },
});

export const deleteDocument = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can delete documents" });

    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Document not found" });

    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(args.documentId);
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    const allDocs = await ctx.db.query("documents").collect();
    const allFolders = await ctx.db.query("folders").collect();
    const totalSize = allDocs.reduce((sum, d) => sum + d.fileSize, 0);
    return {
      documentCount: allDocs.length,
      folderCount: allFolders.length,
      totalSize,
    };
  },
});
