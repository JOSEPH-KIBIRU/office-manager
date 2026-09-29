/**
 * Shared helpers for enumerating all data that belongs to a single organization.
 * Used by the per-company backup export and the hard-delete (purge) routine.
 *
 * Every table below is company-scoped. Most have a `by_org` index; the few that
 * do not are scanned and filtered (they are small, org-level lookup tables).
 */

export const ORG_TABLES = [
  "users",
  "departments",
  "leaves",
  "carLogs",
  "pettyCash",
  "meetings",
  "minutes",
  "profileRequests",
  "annualReset",
  "payrolls",
  "notifications",
  "contacts",
  "invoices",
  "bills",
  "storedFiles",
  "tasks",
  "taskUpdates",
  "pettyCashBudgets",
  "ledgerAccounts",
  "accountingPeriods",
  "journals",
  "bankLines",
  "calendarConnections",
  "calendarEvents",
  "calendarSyncJobs",
] as const;

/** Tables without a `by_org` index — scanned and filtered in memory. */
const NO_ORG_INDEX = new Set<string>(["annualReset", "calendarEvents", "calendarSyncJobs"]);

/** Read up to `limit` rows for an org (used by the batched purge). */
export async function takeForOrg(ctx: any, table: string, orgId: any, limit: number) {
  if (NO_ORG_INDEX.has(table)) {
    const all = await ctx.db.query(table).collect();
    return all.filter((r: any) => r.orgId === orgId).slice(0, limit);
  }
  return ctx.db
    .query(table)
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .take(limit);
}

/** Read every row for an org (used by the backup export). */
export async function allForOrg(ctx: any, table: string, orgId: any) {
  if (NO_ORG_INDEX.has(table)) {
    const all = await ctx.db.query(table).collect();
    return all.filter((r: any) => r.orgId === orgId);
  }
  return ctx.db
    .query(table)
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();
}

/** True if any company-scoped row still exists for the org. */
export async function hasAnyForOrg(ctx: any, orgId: any): Promise<boolean> {
  for (const table of ORG_TABLES) {
    const rows = await takeForOrg(ctx, table, orgId, 1);
    if (rows.length > 0) return true;
  }
  return false;
}

/**
 * Export everything for an organization as a plain JSON-serializable object.
 * Binary files are referenced by URL rather than embedded.
 */
export async function buildOrgExport(ctx: any, orgId: any) {
  const org = await ctx.db.get(orgId);
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const table of ORG_TABLES) {
    const rows = await allForOrg(ctx, table, orgId);
    counts[table] = rows.length;
    data[table] = rows;
  }

  // Attach resolvable URLs for stored binaries (best-effort).
  const files = (data["storedFiles"] as any[]) ?? [];
  for (const f of files) {
    try {
      f.url = await ctx.storage.getUrl(f.storageId);
    } catch {
      f.url = null;
    }
  }
  const minutes = (data["minutes"] as any[]) ?? [];
  for (const m of minutes) {
    if (m.fileId) {
      try {
        m.fileUrl = await ctx.storage.getUrl(m.fileId);
      } catch {
        m.fileUrl = null;
      }
    }
  }
  if (org?.logoFileId) {
    try {
      (org as any).logoUrl = await ctx.storage.getUrl(org.logoFileId);
    } catch {
      /* ignore */
    }
  }

  return {
    meta: {
      app: "Office Manager",
      version: 1,
      orgId,
      orgName: org?.name ?? null,
      slug: org?.slug ?? null,
      exportedAt: new Date().toISOString(),
      counts,
    },
    organization: org ?? null,
    data,
  };
}
