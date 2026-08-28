/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bills from "../bills.js";
import type * as carLogs from "../carLogs.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as invoicing from "../invoicing.js";
import type * as leaves from "../leaves.js";
import type * as lib from "../lib.js";
import type * as meetings from "../meetings.js";
import type * as migration from "../migration.js";
import type * as minutes from "../minutes.js";
import type * as notifications from "../notifications.js";
import type * as orgs from "../orgs.js";
import type * as payroll from "../payroll.js";
import type * as pettyCash from "../pettyCash.js";
import type * as profiles from "../profiles.js";
import type * as seed from "../seed.js";
import type * as storage from "../storage.js";
import type * as superadmin from "../superadmin.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bills: typeof bills;
  carLogs: typeof carLogs;
  crons: typeof crons;
  dashboard: typeof dashboard;
  invoicing: typeof invoicing;
  leaves: typeof leaves;
  lib: typeof lib;
  meetings: typeof meetings;
  migration: typeof migration;
  minutes: typeof minutes;
  notifications: typeof notifications;
  orgs: typeof orgs;
  payroll: typeof payroll;
  pettyCash: typeof pettyCash;
  profiles: typeof profiles;
  seed: typeof seed;
  storage: typeof storage;
  superadmin: typeof superadmin;
  users: typeof users;
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
