/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounting from "../accounting.js";
import type * as analytics from "../analytics.js";
import type * as assets from "../assets.js";
import type * as attendance from "../attendance.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as backup from "../backup.js";
import type * as backupInternals from "../backupInternals.js";
import type * as bills from "../bills.js";
import type * as calendar from "../calendar.js";
import type * as carLogs from "../carLogs.js";
import type * as checklists from "../checklists.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as departments from "../departments.js";
import type * as documents from "../documents.js";
import type * as enquiries from "../enquiries.js";
import type * as health from "../health.js";
import type * as holidays from "../holidays.js";
import type * as invoicing from "../invoicing.js";
import type * as keHolidays from "../keHolidays.js";
import type * as leaves from "../leaves.js";
import type * as lib from "../lib.js";
import type * as meetings from "../meetings.js";
import type * as migration from "../migration.js";
import type * as minutes from "../minutes.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as orgData from "../orgData.js";
import type * as organizations from "../organizations.js";
import type * as orgs from "../orgs.js";
import type * as passwordReset from "../passwordReset.js";
import type * as payroll from "../payroll.js";
import type * as permissions from "../permissions.js";
import type * as pettyCash from "../pettyCash.js";
import type * as profiles from "../profiles.js";
import type * as rateLimit from "../rateLimit.js";
import type * as reminders from "../reminders.js";
import type * as restore from "../restore.js";
import type * as seed from "../seed.js";
import type * as storage from "../storage.js";
import type * as subledger from "../subledger.js";
import type * as subscriptions from "../subscriptions.js";
import type * as superadmin from "../superadmin.js";
import type * as tasks from "../tasks.js";
import type * as twofa from "../twofa.js";
import type * as users from "../users.js";
import type * as visitors from "../visitors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounting: typeof accounting;
  analytics: typeof analytics;
  assets: typeof assets;
  attendance: typeof attendance;
  audit: typeof audit;
  auth: typeof auth;
  backup: typeof backup;
  backupInternals: typeof backupInternals;
  bills: typeof bills;
  calendar: typeof calendar;
  carLogs: typeof carLogs;
  checklists: typeof checklists;
  crons: typeof crons;
  dashboard: typeof dashboard;
  departments: typeof departments;
  documents: typeof documents;
  enquiries: typeof enquiries;
  health: typeof health;
  holidays: typeof holidays;
  invoicing: typeof invoicing;
  keHolidays: typeof keHolidays;
  leaves: typeof leaves;
  lib: typeof lib;
  meetings: typeof meetings;
  migration: typeof migration;
  minutes: typeof minutes;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  orgData: typeof orgData;
  organizations: typeof organizations;
  orgs: typeof orgs;
  passwordReset: typeof passwordReset;
  payroll: typeof payroll;
  permissions: typeof permissions;
  pettyCash: typeof pettyCash;
  profiles: typeof profiles;
  rateLimit: typeof rateLimit;
  reminders: typeof reminders;
  restore: typeof restore;
  seed: typeof seed;
  storage: typeof storage;
  subledger: typeof subledger;
  subscriptions: typeof subscriptions;
  superadmin: typeof superadmin;
  tasks: typeof tasks;
  twofa: typeof twofa;
  users: typeof users;
  visitors: typeof visitors;
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
