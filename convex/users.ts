import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user !== null) {
      // If user doesn't have an org yet, check for a pending invite
      if (!user.organizationId) {
        const email = identity.email;
        if (email) {
          const invites = await ctx.db
            .query("invites")
            .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
            .collect();
          const pendingInvite = invites.find((i) => i.status === "pending");
          if (pendingInvite) {
            await ctx.db.patch(user._id, {
              organizationId: pendingInvite.organizationId,
              role: pendingInvite.role,
            });
            await ctx.db.patch(pendingInvite._id, { status: "accepted" });
          }
        }
      }
      return user._id;
    }

    // New user – check for a pending invite before creating the record
    const email = identity.email;
    if (email) {
      const invites = await ctx.db
        .query("invites")
        .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
        .collect();
      const pendingInvite = invites.find((i) => i.status === "pending");
      if (pendingInvite) {
        await ctx.db.patch(pendingInvite._id, { status: "accepted" });
        return await ctx.db.insert("users", {
          name: identity.name,
          email: identity.email,
          tokenIdentifier: identity.tokenIdentifier,
          organizationId: pendingInvite.organizationId,
          role: pendingInvite.role,
        });
      }
    }

    // No invite found – create a plain user
    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    });
  },
});

/** Get all staff members for the scheduling grid */
export const getAllStaff = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }
    return await ctx.db.query("users").collect();
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Called getCurrentUser without authentication present",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    return user;
  },
});
