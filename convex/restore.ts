import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret } from "./lib";
import { assertSuperAdmin } from "./superadmin";
import { ORG_TABLES, takeForOrg, hasAnyForOrg } from "./orgData";
import { internal, api } from "./_generated/api";

/**
 * In-place snapshot restore.
 *
 * A snapshot is a JSON document in Convex storage produced by backup.ts
 * (`buildOrgExport`). Restoring wipes the organization's transactional data and
 * rebuilds every table from the snapshot, remapping old Convex IDs to freshly
 * generated ones. The organization row itself is preserved (same id/slug), so
 * users keep the same company and login URL.
 *
 * Binary blobs (logos, minute files, stored files) are not re-uploaded — they
 * are referenced by URL only in the export and are dropped on restore.
 */

/** Foreign-key fields per table that reference another table's ids. */
const FK: Record<string, string[]> = {
  users: ["departmentId"],
  staffLoans: ["userId"],
  leaves: ["userId", "approvedBy"],
  leaveCarryOvers: ["userId"],
  attendance: ["userId"],
  documents: ["userId"],
  checklistItems: ["userId", "doneBy"],
  carLogs: ["requestedBy", "approvedBy"],
  pettyCash: ["requestedBy", "approvedBy"],
  meetings: ["directorId", "createdBy"],
  minutes: ["meetingId", "writtenBy"],
  profileRequests: ["userId", "reviewedBy"],
  payrolls: ["runBy", "paidBy"],
  casualAttendance: ["casualId"],
  assets: ["currentHolderId"],
  assetMovements: ["assetId", "holderId", "recordedBy"],
  notifications: ["userId"],
  invoices: ["contactId", "createdBy"],
  bills: ["contactId", "createdBy"],
  tasks: ["createdBy", "assigneeId", "acknowledgedBy"],
  taskUpdates: ["taskId", "userId"],
  pettyCashBudgets: ["setBy"],
  accountingPeriods: ["lockedBy"],
  journals: ["postedBy"],
  bankLines: ["journalId"],
  calendarConnections: ["userId"],
  calendarEvents: ["userId"],
  calendarSyncJobs: ["userId"],
  visitors: ["visitorTo"],
};

/** Dependency order for rebuilding (referenced tables must come first). */
const RESTORE_ORDER = [
  "departments",
  "users",
  "casuals",
  "contacts",
  "ledgerAccounts",
  "holidays",
  "staffLoans",
  "leaves",
  "leaveCarryOvers",
  "attendance",
  "documents",
  "checklistItems",
  "carLogs",
  "pettyCash",
  "meetings",
  "minutes",
  "profileRequests",
  "annualReset",
  "payrolls",
  "casualAttendance",
  "assets",
  "assetMovements",
  "notifications",
  "invoices",
  "bills",
  "tasks",
  "taskUpdates",
  "pettyCashBudgets",
  "accountingPeriods",
  "journals",
  "bankLines",
  "calendarConnections",
  "calendarEvents",
  "calendarSyncJobs",
  "visitors",
] as const;

/** Blobs that cannot be restored (only URLs were exported) — skip them. */
const SKIP = new Set<string>(["storedFiles"]);

function remapRow(table: string, row: Record<string, unknown>, idMap: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  delete out._id;
  delete out._creationTime;
  const map = (v: unknown): unknown => (typeof v === "string" && idMap[v] ? idMap[v] : v);

  for (const f of FK[table] ?? []) {
    if (out[f] !== undefined && out[f] !== null) out[f] = map(out[f]);
  }
  if (table === "meetings" && Array.isArray(out.attendeeIds)) {
    out.attendeeIds = out.attendeeIds.map(map);
  }
  if (table === "payrolls" && Array.isArray(out.payslips)) {
    out.payslips = (out.payslips as Record<string, unknown>[]).map((sl) => ({
      ...sl,
      userId: sl.userId != null ? map(sl.userId) : sl.userId,
      casualId: sl.casualId != null ? map(sl.casualId) : sl.casualId,
      loanId: sl.loanId != null ? map(sl.loanId) : sl.loanId,
    }));
  }
  if (table === "minutes") {
    out.fileId = undefined; // binary minutes can't be restored
  }
  return out;
}

/** Fetch + validate a snapshot document (returns its storage id). */
export const getSnapshotDoc = internalQuery({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    snapshotId: v.id("backups"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const snap = await ctx.db.get(args.snapshotId);
    if (!snap) throw new Error("Snapshot not found");
    if (snap.orgId !== args.orgId) throw new Error("Snapshot does not belong to this company");
    return { storageId: snap.storageId, orgName: snap.orgName };
  },
});

/** Delete every company-scoped row (and owned blobs), keeping the org itself. */
export const purgeForRestore = internalMutation({
  args: { secret: v.string(), orgId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 300);
    let deleted = 0;
    for (const table of ORG_TABLES) {
      if (SKIP.has(table)) continue;
      const rows = await takeForOrg(ctx, table, args.orgId, limit);
      for (const r of rows as any[]) {
        if (table === "minutes" && r.fileId) {
          try { await ctx.storage.delete(r.fileId); } catch { /* ignore */ }
        }
        await ctx.db.delete(r._id);
        deleted++;
      }
    }
    const more = await hasAnyForOrg(ctx, args.orgId);
    return { deleted, done: !more };
  },
});

/** Insert one table's rows, remapping ids and returning the new id map. */
export const restoreTable = internalMutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    table: v.string(),
    rows: v.array(v.any()),
    idMap: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const idMap = { ...args.idMap };
    const table = args.table;
    const isJournals = table === "journals";

    const inserted: Array<{ newId: string; row: Record<string, unknown> }> = [];
    for (const row of args.rows as Record<string, unknown>[]) {
      const cleaned = remapRow(table, row, idMap);
      if (isJournals) {
        cleaned.reversedBy = undefined;
        cleaned.reversesId = undefined;
      }
      const newId = await ctx.db.insert(table as never, cleaned as never);
      if (row._id) idMap[String(row._id)] = String(newId);
      inserted.push({ newId: String(newId), row });
    }

    if (isJournals) {
      for (const r of inserted) {
        const patch: Record<string, unknown> = {};
        if (r.row.reversedBy && idMap[String(r.row.reversedBy)]) patch.reversedBy = idMap[String(r.row.reversedBy)];
        if (r.row.reversesId && idMap[String(r.row.reversesId)]) patch.reversesId = idMap[String(r.row.reversesId)];
        if (Object.keys(patch).length) await ctx.db.patch(r.newId as never, patch as never);
      }
    }

    return { idMap, inserted: inserted.length };
  },
});

/** Patch the organization row's config fields from the snapshot (same org). */
export const patchOrgFromSnapshot = internalMutation({
  args: { secret: v.string(), orgId: v.id("organizations"), org: v.any() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const current = await ctx.db.get(args.orgId);
    if (!current) throw new Error("Organization not found");
    const o = args.org as Record<string, unknown> | null;
    if (!o) return { patched: false };

    const fields = [
      "name", "address", "city", "phone", "email", "taxNumber", "website",
      "paymentDetails", "invoiceNotes", "invoiceTerms", "workingDays",
      "etimsEnabled", "etimsEnv", "etimsBaseUrl", "etimsTin", "etimsBhfId",
      "etimsDeviceSerial", "etimsApiKey", "etimsApiSecret", "remindersEnabled",
      "reminderIntervalDays", "reminderMax", "leaveEntitlement", "leaveCarryOverMax",
      "leaveEncashment", "workStartTime", "workEndTime", "graceMinutes",
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      if (o[f] !== undefined) patch[f] = o[f];
    }
    await ctx.db.patch(args.orgId, patch as never);
    return { patched: true };
  },
});

export const restoreSnapshot = action({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    orgId: v.id("organizations"),
    snapshotId: v.id("backups"),
  },
  handler: async (ctx, args): Promise<{ restored: number; snapshotId: string }> => {
    assertSecret(args.secret);

    const doc = await ctx.runQuery(internal.restore.getSnapshotDoc, {
      secret: args.secret,
      superAdminId: args.superAdminId,
      snapshotId: args.snapshotId,
      orgId: args.orgId,
    });

    const blob = await ctx.storage.get(doc.storageId);
    if (!blob) throw new Error("Snapshot file is missing");
    const text = await blob.text();
    const payload = JSON.parse(text) as {
      meta?: { version?: number };
      organization?: unknown;
      data?: Record<string, unknown[]>;
    };
    if (payload.meta?.version !== 1) throw new Error("Unsupported snapshot version");
    if (!payload.data) throw new Error("Snapshot has no data");

    // 1. Safety snapshot of the current state before we touch anything.
    await ctx.runAction(api.backup.createSnapshot, {
      secret: args.secret,
      superAdminId: args.superAdminId,
      orgId: args.orgId,
      kind: "pre_restore",
    });

    // 2. Wipe current data (bounded batches).
    for (;;) {
      const res = await ctx.runMutation(internal.restore.purgeForRestore, {
        secret: args.secret,
        orgId: args.orgId,
        limit: 150,
      });
      if (res.done) break;
    }

    // 3. Restore the organization config from the snapshot.
    await ctx.runMutation(internal.restore.patchOrgFromSnapshot, {
      secret: args.secret,
      orgId: args.orgId,
      org: payload.organization ?? null,
    });

    // 4. Rebuild tables in dependency order.
    const idMap: Record<string, string> = {};
    let restored = 0;
    for (const table of RESTORE_ORDER) {
      const rows = (payload.data[table] as Record<string, unknown>[]) ?? [];
      if (rows.length === 0) continue;
      const res = await ctx.runMutation(internal.restore.restoreTable, {
        secret: args.secret,
        orgId: args.orgId,
        table,
        rows,
        idMap,
      });
      Object.assign(idMap, res.idMap);
      restored += res.inserted;
    }

    return { restored, snapshotId: args.snapshotId };
  },
});
