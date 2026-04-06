import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";

// ─── Admin: Gift catalog CRUD ────────────────────────────────────────

/** Create a new gift */
export const createGift = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    pointsCost: v.number(),
    category: v.union(
      v.literal("voucher"),
      v.literal("time_off"),
      v.literal("merchandise"),
      v.literal("experience")
    ),
    imageStorageId: v.optional(v.id("_storage")),
    stock: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });

    if (args.pointsCost < 1) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Points cost must be at least 1" });
    }

    return await ctx.db.insert("rewardGifts", {
      name: args.name.trim(),
      description: args.description?.trim(),
      pointsCost: args.pointsCost,
      category: args.category,
      imageStorageId: args.imageStorageId,
      stock: args.stock,
      active: true,
    });
  },
});

/** Update a gift */
export const updateGift = mutation({
  args: {
    giftId: v.id("rewardGifts"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    pointsCost: v.optional(v.number()),
    category: v.optional(
      v.union(
        v.literal("voucher"),
        v.literal("time_off"),
        v.literal("merchandise"),
        v.literal("experience")
      )
    ),
    imageStorageId: v.optional(v.id("_storage")),
    stock: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });

    const gift = await ctx.db.get(args.giftId);
    if (!gift) throw new ConvexError({ code: "NOT_FOUND", message: "Gift not found" });

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.description !== undefined) updates.description = args.description.trim();
    if (args.pointsCost !== undefined) {
      if (args.pointsCost < 1) throw new ConvexError({ code: "BAD_REQUEST", message: "Points cost must be at least 1" });
      updates.pointsCost = args.pointsCost;
    }
    if (args.category !== undefined) updates.category = args.category;
    if (args.imageStorageId !== undefined) updates.imageStorageId = args.imageStorageId;
    if (args.stock !== undefined) updates.stock = args.stock;
    if (args.active !== undefined) updates.active = args.active;

    await ctx.db.patch(args.giftId, updates);
  },
});

/** Delete a gift (only if no pending redemptions) */
export const deleteGift = mutation({
  args: { giftId: v.id("rewardGifts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (user.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });

    const gift = await ctx.db.get(args.giftId);
    if (!gift) throw new ConvexError({ code: "NOT_FOUND", message: "Gift not found" });

    const pendingRedemptions = await ctx.db
      .query("giftRedemptions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    if (pendingRedemptions.some((r) => r.giftId === args.giftId)) {
      throw new ConvexError({ code: "CONFLICT", message: "Cannot delete a gift with pending redemptions. Fulfill or cancel them first." });
    }

    await ctx.db.delete(args.giftId);
  },
});

// ─── Public: list gifts ──────────────────────────────────────────────

/** List active gifts for the shop */
export const listGifts = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });

    let gifts;
    if (args.includeInactive) {
      gifts = await ctx.db.query("rewardGifts").collect();
    } else {
      gifts = await ctx.db.query("rewardGifts").withIndex("by_active", (q) => q.eq("active", true)).collect();
    }

    return await Promise.all(
      gifts.map(async (g) => ({
        ...g,
        imageUrl: g.imageStorageId ? await ctx.storage.getUrl(g.imageStorageId) : null,
      }))
    );
  },
});

// ─── Staff: redeem a gift ────────────────────────────────────────────

/** Redeem points for a gift */
export const redeemGift = mutation({
  args: { giftId: v.id("rewardGifts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const gift = await ctx.db.get(args.giftId);
    if (!gift || !gift.active) throw new ConvexError({ code: "NOT_FOUND", message: "Gift not found or no longer available" });

    if (gift.stock !== undefined && gift.stock <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "This gift is out of stock" });
    }

    // Calculate available balance
    const earned = await ctx.db.query("rewards").withIndex("by_to_user", (q) => q.eq("toUserId", user._id)).collect();
    const totalEarned = earned.reduce((sum, r) => sum + (r.points ?? 0), 0);

    const spent = await ctx.db.query("giftRedemptions").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const totalSpent = spent.filter((r) => r.status !== "cancelled").reduce((sum, r) => sum + r.pointsSpent, 0);

    const balance = totalEarned - totalSpent;
    if (balance < gift.pointsCost) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Not enough points. You have ${balance} but need ${gift.pointsCost}.` });
    }

    if (gift.stock !== undefined) {
      await ctx.db.patch(args.giftId, { stock: gift.stock - 1 });
    }

    await ctx.db.insert("giftRedemptions", {
      userId: user._id,
      giftId: args.giftId,
      pointsSpent: gift.pointsCost,
      status: "pending",
    });
  },
});

// ─── Redemption management ───────────────────────────────────────────

/** List redemptions — admin sees all, staff sees own */
export const listRedemptions = query({
  args: { statusFilter: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const isAdmin = user.role === "admin";

    let redemptions;
    if (args.statusFilter && args.statusFilter !== "all") {
      redemptions = await ctx.db
        .query("giftRedemptions")
        .withIndex("by_status", (q) => q.eq("status", args.statusFilter as "pending" | "fulfilled" | "cancelled"))
        .order("desc")
        .collect();
    } else {
      redemptions = await ctx.db.query("giftRedemptions").order("desc").collect();
    }

    if (!isAdmin) {
      redemptions = redemptions.filter((r) => r.userId === user._id);
    }

    const users = await ctx.db.query("users").collect();
    const nameMap = new Map(users.map((u) => [String(u._id), u.name ?? "Unknown"]));

    return await Promise.all(
      redemptions.map(async (r) => {
        const gift = await ctx.db.get(r.giftId);
        return {
          _id: r._id,
          _creationTime: r._creationTime,
          userId: r.userId,
          userName: nameMap.get(String(r.userId)) ?? "Unknown",
          giftId: r.giftId,
          giftName: gift?.name ?? "Deleted gift",
          giftCategory: gift?.category,
          pointsSpent: r.pointsSpent,
          status: r.status,
          fulfilledBy: r.fulfilledBy,
          fulfilledByName: r.fulfilledBy ? (nameMap.get(String(r.fulfilledBy)) ?? "Unknown") : undefined,
          fulfilledAt: r.fulfilledAt,
          adminNote: r.adminNote,
        };
      })
    );
  },
});

/** Count pending redemptions (admin badge) */
export const pendingRedemptionCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user || user.role !== "admin") return 0;

    const pending = await ctx.db.query("giftRedemptions").withIndex("by_status", (q) => q.eq("status", "pending")).collect();
    return pending.length;
  },
});

/** Admin: mark redemption as fulfilled */
export const fulfillRedemption = mutation({
  args: {
    redemptionId: v.id("giftRedemptions"),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const admin = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!admin) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (admin.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });

    const redemption = await ctx.db.get(args.redemptionId);
    if (!redemption) throw new ConvexError({ code: "NOT_FOUND", message: "Redemption not found" });
    if (redemption.status !== "pending") throw new ConvexError({ code: "BAD_REQUEST", message: "Redemption already processed" });

    await ctx.db.patch(args.redemptionId, {
      status: "fulfilled",
      fulfilledBy: admin._id,
      fulfilledAt: new Date().toISOString(),
      adminNote: args.adminNote?.trim(),
    });
  },
});

/** Admin: cancel a redemption (refunds points) */
export const cancelRedemption = mutation({
  args: {
    redemptionId: v.id("giftRedemptions"),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const admin = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!admin) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (admin.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });

    const redemption = await ctx.db.get(args.redemptionId);
    if (!redemption) throw new ConvexError({ code: "NOT_FOUND", message: "Redemption not found" });
    if (redemption.status !== "pending") throw new ConvexError({ code: "BAD_REQUEST", message: "Redemption already processed" });

    // Restore stock
    const gift = await ctx.db.get(redemption.giftId);
    if (gift && gift.stock !== undefined) {
      await ctx.db.patch(redemption.giftId, { stock: gift.stock + 1 });
    }

    await ctx.db.patch(args.redemptionId, {
      status: "cancelled",
      fulfilledBy: admin._id,
      fulfilledAt: new Date().toISOString(),
      adminNote: args.adminNote?.trim(),
    });
  },
});

// ─── Admin: issue a gift directly to a user ─────────────────────────

/** Admin: issue a gift to a user (creates a fulfilled redemption) */
export const issueGift = mutation({
  args: {
    userId: v.id("users"),
    giftId: v.id("rewardGifts"),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const admin = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!admin) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (admin.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new ConvexError({ code: "NOT_FOUND", message: "Target user not found" });

    const gift = await ctx.db.get(args.giftId);
    if (!gift) throw new ConvexError({ code: "NOT_FOUND", message: "Gift not found" });

    // Decrement stock if applicable
    if (gift.stock !== undefined && gift.stock <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "This gift is out of stock" });
    }
    if (gift.stock !== undefined) {
      await ctx.db.patch(args.giftId, { stock: gift.stock - 1 });
    }

    // Create a fulfilled redemption (no points deducted — admin-issued)
    await ctx.db.insert("giftRedemptions", {
      userId: args.userId,
      giftId: args.giftId,
      pointsSpent: 0,
      status: "fulfilled",
      fulfilledBy: admin._id,
      fulfilledAt: new Date().toISOString(),
      adminNote: args.adminNote?.trim() || "Issued by admin",
    });
  },
});

// ─── Balance that accounts for spent points ──────────────────────────

/** Get available points balance (earned minus spent) */
export const getAvailableBalance = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const earned = await ctx.db.query("rewards").withIndex("by_to_user", (q) => q.eq("toUserId", user._id)).collect();
    const totalEarned = earned.reduce((sum, r) => sum + (r.points ?? 0), 0);

    const spent = await ctx.db.query("giftRedemptions").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const totalSpent = spent.filter((r) => r.status !== "cancelled").reduce((sum, r) => sum + r.pointsSpent, 0);

    return { totalEarned, totalSpent, available: totalEarned - totalSpent };
  },
});
