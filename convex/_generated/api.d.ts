/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as availability from "../availability.js";
import type * as calendarEvents from "../calendarEvents.js";
import type * as documents from "../documents.js";
import type * as feedback from "../feedback.js";
import type * as giftShop from "../giftShop.js";
import type * as leaveRequests from "../leaveRequests.js";
import type * as messaging from "../messaging.js";
import type * as organizations from "../organizations.js";
import type * as positions from "../positions.js";
import type * as postComments from "../postComments.js";
import type * as posts from "../posts.js";
import type * as profiles from "../profiles.js";
import type * as recognitions from "../recognitions.js";
import type * as rewardNominations from "../rewardNominations.js";
import type * as rewards from "../rewards.js";
import type * as shiftPatterns from "../shiftPatterns.js";
import type * as shiftSwaps from "../shiftSwaps.js";
import type * as shifts from "../shifts.js";
import type * as superAdmin from "../superAdmin.js";
import type * as timeTracking from "../timeTracking.js";
import type * as users from "../users.js";
import type * as vehicleAllocations from "../vehicleAllocations.js";
import type * as vehicles from "../vehicles.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  availability: typeof availability;
  calendarEvents: typeof calendarEvents;
  documents: typeof documents;
  feedback: typeof feedback;
  giftShop: typeof giftShop;
  leaveRequests: typeof leaveRequests;
  messaging: typeof messaging;
  organizations: typeof organizations;
  positions: typeof positions;
  postComments: typeof postComments;
  posts: typeof posts;
  profiles: typeof profiles;
  recognitions: typeof recognitions;
  rewardNominations: typeof rewardNominations;
  rewards: typeof rewards;
  shiftPatterns: typeof shiftPatterns;
  shiftSwaps: typeof shiftSwaps;
  shifts: typeof shifts;
  superAdmin: typeof superAdmin;
  timeTracking: typeof timeTracking;
  users: typeof users;
  vehicleAllocations: typeof vehicleAllocations;
  vehicles: typeof vehicles;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
