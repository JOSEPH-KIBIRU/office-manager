import { mutation, internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

/**
 * Admin/ops-driven data migrations.
 *
 * Unlike schema changes (which Convex manages declaratively via schema.ts),
 * these are one-time data backfills. Every migration registers a `name` in the
 * `migrations` table the first time it succeeds, so reruns are no-ops — each
 * migration is guaranteed to run at most once.
 *
 * Trigger from the Convex dashboard:
 *   convex.migration.runMigrations({ secret: "<CONVEX_SERVER_SECRET>" })
 */

type MigrationArgs = {
  orgName?: string;
};

const MIGRATIONS: Record<
  string,
  (ctx: MutationCtx, args: MigrationArgs) => Promise<unknown>
> = {
  /**
   * Create the default organization (if missing) and stamp orgId onto every
   * existing document that lacks one. Safe to rerun: skips docs with orgId.
   */
  backfillOrgs: async (ctx, args) => {
    let org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", "default"))
      .unique();
    if (!org) {
      const orgId = await ctx.db.insert("organizations", {
        name: args.orgName || "Office",
        slug: "default",
        active: true,
        createdAt: tsNow(),
      });
      org = await ctx.db.get(orgId);
    }
    if (!org) throw new Error("Failed to create default organization");
    const orgId = org._id;

    const counts: Record<string, number> = {};

    for (const u of await ctx.db.query("users").collect()) {
      if (!u.orgId) {
        await ctx.db.patch(u._id, { orgId });
        counts.users = (counts.users ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("leaves").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.leaves = (counts.leaves ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("carLogs").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.carLogs = (counts.carLogs ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("pettyCash").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.pettyCash = (counts.pettyCash ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("meetings").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.meetings = (counts.meetings ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("minutes").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.minutes = (counts.minutes ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("profileRequests").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.profileRequests = (counts.profileRequests ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("annualReset").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.annualReset = (counts.annualReset ?? 0) + 1;
      }
    }

    return { orgId, migrated: counts };
  },
};

/**
 * Run every registered migration not yet recorded in the `migrations` table.
 * Idempotent: already-applied migrations are skipped. Safe to call repeatedly.
 */
export const runMigrations = mutation({
  args: {
    secret: v.string(),
    orgName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    const migrationArgs: MigrationArgs = { orgName: args.orgName };

    const results: Record<string, string> = {};
    let applied = 0;

    for (const name of Object.keys(MIGRATIONS)) {
      const already = await ctx.db
        .query("migrations")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();
      if (already) {
        results[name] = "skipped";
        continue;
      }

      await MIGRATIONS[name](ctx, migrationArgs);
      await ctx.db.insert("migrations", { name, runAt: tsNow() });
      results[name] = "applied";
      applied += 1;
    }

    return { applied, results };
  },
});

/**
 * Legacy one-off org-backfill, kept for manual/backward-compatible invocation.
 * Note: this does NOT record itself in the migrations table; prefer
 * `runMigrations` so the run is tracked and idempotent across calls.
 */
export const backfillOrgs = mutation({
  args: {
    secret: v.string(),
    orgName: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return MIGRATIONS.backfillOrgs(ctx, { orgName: args.orgName });
  },
});

/**
 * One-off: keep the newly-added "audit-log" module enabled for every company
 * that already had a restricted `enabledModules` list. Without this, making the
 * audit trail platform-controllable would hide it from existing companies.
 * Idempotent (recorded in the `migrations` table).
 */
export const ensureAuditLogModule = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const name = "ensureAuditLogModule";
    const already = await ctx.db
      .query("migrations")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (already) return { skipped: true, updated: 0 };

    let updated = 0;
    for (const o of await ctx.db.query("organizations").collect()) {
      if (Array.isArray(o.enabledModules) && !o.enabledModules.includes("audit-log")) {
        await ctx.db.patch(o._id, { enabledModules: [...o.enabledModules, "audit-log"] });
        updated += 1;
      }
    }
    await ctx.db.insert("migrations", { name, runAt: tsNow() });
    return { skipped: false, updated };
  },
});

/** Same as `ensureAuditLogModule` but callable from the Convex CLI/dashboard
 *  (internal, so no server secret is needed): `npx convex run migration:ensureAuditLogModuleInternal`. */
export const ensureAuditLogModuleInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const name = "ensureAuditLogModule";
    const already = await ctx.db
      .query("migrations")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (already) return { skipped: true, updated: 0, restricted: [] as string[] };

    let updated = 0;
    const restricted: string[] = [];
    for (const o of await ctx.db.query("organizations").collect()) {
      if (Array.isArray(o.enabledModules)) {
        restricted.push(o.name);
        if (!o.enabledModules.includes("audit-log")) {
          await ctx.db.patch(o._id, { enabledModules: [...o.enabledModules, "audit-log"] });
          updated += 1;
        }
      }
    }
    await ctx.db.insert("migrations", { name, runAt: tsNow() });
    return { skipped: false, updated, restricted };
  },
});

/** New accounting modules must be added to any company with a restricted cap. */
const ACCOUNTING_MODULES = [
  "customers",
  "suppliers",
  "receipts",
  "payments",
  "chart-of-accounts",
  "accounting-post",
  "accounting-reverse",
];

export const ensureAccountingModulesInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const name = "ensureAccountingModules";
    const already = await ctx.db
      .query("migrations")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (already) return { skipped: true, updated: 0 };

    let updated = 0;
    for (const o of await ctx.db.query("organizations").collect()) {
      if (Array.isArray(o.enabledModules)) {
        const merged = Array.from(new Set([...o.enabledModules, ...ACCOUNTING_MODULES]));
        if (merged.length !== o.enabledModules.length) {
          await ctx.db.patch(o._id, { enabledModules: merged });
          updated += 1;
        }
      }
    }
    await ctx.db.insert("migrations", { name, runAt: tsNow() });
    return { skipped: false, updated };
  },
});

/** New management modules must be added to any company with a restricted cap. */
const MANAGEMENT_MODULES = ["cost-centres", "projects", "budgets", "management-reports"];

export const ensureManagementModulesInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const name = "ensureManagementModules";
    const already = await ctx.db
      .query("migrations")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (already) return { skipped: true, updated: 0 };

    let updated = 0;
    for (const o of await ctx.db.query("organizations").collect()) {
      if (Array.isArray(o.enabledModules)) {
        const merged = Array.from(new Set([...o.enabledModules, ...MANAGEMENT_MODULES]));
        if (merged.length !== o.enabledModules.length) {
          await ctx.db.patch(o._id, { enabledModules: merged });
          updated += 1;
        }
      }
    }
    await ctx.db.insert("migrations", { name, runAt: tsNow() });
    return { skipped: false, updated };
  },
});

/**
 * Backfill the AR/AP sub-ledger for invoices/bills already marked paid before
 * the open-item layer existed. This only creates the sub-ledger records
 * (payment + allocation + amountPaid) — it NEVER posts new journals, so no
 * historical accounting entry is duplicated. For old "mark paid" bills it links
 * the existing settlement journal.
 */
export const backfillSubledgerInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const name = "backfillSubledger";
    const already = await ctx.db
      .query("migrations")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (already) return { skipped: true, receipts: 0, payments: 0 };

    let receipts = 0;
    let payments = 0;
    for (const org of await ctx.db.query("organizations").collect()) {
      const invoices = await ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", org._id)).collect();
      for (const inv of invoices) {
        if (inv.status !== "paid" || (inv.amountPaid ?? 0) > 0) continue;
        const allocs = await ctx.db.query("allocations").withIndex("by_invoice", (q) => q.eq("invoiceId", inv._id)).collect();
        if (allocs.length) continue;
        const pid = await ctx.db.insert("payments", {
          orgId: org._id,
          contactId: inv.contactId,
          kind: "receipt",
          date: inv.issueDate,
          amount: inv.total,
          method: "bank",
          accountCode: "1020",
          reference: inv.number,
          notes: "Backfilled (historical paid invoice)",
          createdByName: "Migration",
          createdAt: Date.now(),
        });
        await ctx.db.insert("allocations", { orgId: org._id, invoiceId: inv._id, amount: inv.total, paymentId: pid, createdAt: Date.now() });
        await ctx.db.patch(inv._id, { amountPaid: inv.total });
        receipts += 1;
      }

      const bills = await ctx.db.query("bills").withIndex("by_org", (q) => q.eq("orgId", org._id)).collect();
      for (const bill of bills) {
        if (bill.status !== "paid" || (bill.amountPaid ?? 0) > 0) continue;
        const allocs = await ctx.db.query("allocations").withIndex("by_bill", (q) => q.eq("billId", bill._id)).collect();
        if (allocs.length) continue;
        const settle = await ctx.db
          .query("journals")
          .withIndex("by_source", (q) =>
            q.eq("orgId", org._id).eq("source", "bill").eq("sourceId", `${bill._id}:payment` as never)
          )
          .first();
        const pid = await ctx.db.insert("payments", {
          orgId: org._id,
          contactId: bill.contactId,
          kind: "payment",
          date: bill.billDate,
          amount: bill.amount,
          method: "bank",
          accountCode: "1020",
          reference: bill.number,
          notes: "Backfilled (historical paid bill)",
          journalId: settle?._id,
          createdByName: "Migration",
          createdAt: Date.now(),
        });
        await ctx.db.insert("allocations", { orgId: org._id, billId: bill._id, amount: bill.amount, paymentId: pid, createdAt: Date.now() });
        await ctx.db.patch(bill._id, { amountPaid: bill.amount });
        payments += 1;
      }
    }
    await ctx.db.insert("migrations", { name, runAt: tsNow() });
    return { skipped: false, receipts, payments };
  },
});
