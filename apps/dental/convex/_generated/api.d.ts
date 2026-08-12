/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as auth from "../auth.js";
import type * as authBridge from "../authBridge.js";
import type * as authMigration from "../authMigration.js";
import type * as bookingAvailability from "../bookingAvailability.js";
import type * as http from "../http.js";
import type * as lib_recurringDates from "../lib/recurringDates.js";
import type * as migration from "../migration.js";
import type * as mirroredTables from "../mirroredTables.js";
import type * as recurringExpenses from "../recurringExpenses.js";
import type * as testHelpers from "../testHelpers.js";
import type * as treatmentList from "../treatmentList.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  auth: typeof auth;
  authBridge: typeof authBridge;
  authMigration: typeof authMigration;
  bookingAvailability: typeof bookingAvailability;
  http: typeof http;
  "lib/recurringDates": typeof lib_recurringDates;
  migration: typeof migration;
  mirroredTables: typeof mirroredTables;
  recurringExpenses: typeof recurringExpenses;
  testHelpers: typeof testHelpers;
  treatmentList: typeof treatmentList;
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
