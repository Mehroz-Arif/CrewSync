import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Default field labels and icons for customizable fields.
 * Icons are lucide-react icon names.
 */
const DEFAULT_FIELD_LABELS = {
  vehicle: { label: "Vehicle", icon: "Truck" },
  callSign: { label: "Call Sign", icon: "Radio" },
  location: { label: "Location", icon: "MapPin" },
} as const;

type FieldKey = keyof typeof DEFAULT_FIELD_LABELS;

type FieldLabels = Record<FieldKey, { label: string; icon: string }>;

/** Get the current field labels (public, no auth required for reading) */
export const getFieldLabels = query({
  args: {},
  handler: async (ctx): Promise<FieldLabels> => {
    const setting = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "fieldLabels"))
      .unique();

    if (!setting) {
      return { ...DEFAULT_FIELD_LABELS };
    }

    const saved = JSON.parse(setting.value) as Partial<FieldLabels>;
    return {
      vehicle: saved.vehicle ?? DEFAULT_FIELD_LABELS.vehicle,
      callSign: saved.callSign ?? DEFAULT_FIELD_LABELS.callSign,
      location: saved.location ?? DEFAULT_FIELD_LABELS.location,
    };
  },
});

/** Update field labels (super admin only) */
export const updateFieldLabels = mutation({
  args: {
    vehicle: v.optional(v.object({ label: v.string(), icon: v.string() })),
    callSign: v.optional(v.object({ label: v.string(), icon: v.string() })),
    location: v.optional(v.object({ label: v.string(), icon: v.string() })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || !user.isSuperAdmin) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Super admin access required" });
    }

    // Get existing or start fresh
    const existing = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "fieldLabels"))
      .unique();

    const current: FieldLabels = existing
      ? JSON.parse(existing.value)
      : { ...DEFAULT_FIELD_LABELS };

    // Merge updates
    if (args.vehicle) current.vehicle = args.vehicle;
    if (args.callSign) current.callSign = args.callSign;
    if (args.location) current.location = args.location;

    const value = JSON.stringify(current);

    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("platformSettings", { key: "fieldLabels", value });
    }
  },
});
