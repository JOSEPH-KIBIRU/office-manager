import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertSecret, tsNow } from "./lib";
import { roundKes } from "./accounting";

/**
 * Month-end close: a checklist per period plus integrity checks. A period can
 * be Open → Pending close → Closed → Locked. Closed periods block normal
 * postings (adjustment journals and reversals are still allowed); locked
 * periods block everything.
 */

const DEFAULT_TASKS: Array<{ key: string; label: string }> = [
  { key: "bank_reconciliation", label: "Bank reconciliation" },
  { key: "mpesa_reconciliation", label: "M-Pesa reconciliation" },
  { key: "ar_review", label: "AR review" },
  { key: "ap_review", label: "AP review" },
  { key: "payroll_posted", label: "Payroll posted" },
  { key: "vat_reviewed", label: "VAT reviewed" },
  { key: "depreciation_posted", label: "Depreciation posted" },
  { key: "recurring_processed", label: "Recurring transactions processed" },
  { key: "adjusting_journals", label: "Adjusting journals" },
  { key: "trial_balance_reviewed", label: "Trial balance reviewed" },
  { key: "financials_reviewed", label: "Financial statements reviewed" },
];

async function ensureChecklist(ctx: MutationCtx, orgId: Id<"organizations">, period: string): Promise<void> {
  const existing = await ctx.db
    .query("closeTasks")
    .withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("period", period))
    .collect();
  if (existing.length > 0) return;
  for (const t of DEFAULT_TASKS) {
    await ctx.db.insert("closeTasks", {
      orgId,
      period,
      key: t.key,
      label: t.label,
      status: "pending",
      updatedAt: tsNow(),
    });
  }
}

function periodEnd(period: string): string {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${period}-${String(last).padStart(2, "0")}`;
}

async function buildSummary(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">, period: string) {
  const through = periodEnd(period);
  const journals = await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();

  // Trial balance difference (through period end).
  let dr = 0;
  let cr = 0;
  let draftJournals = 0;
  for (const j of journals) {
    if (j.date > through) continue;
    if (j.reversedBy) continue;
    for (const l of j.lines) {
      dr += l.debit;
      cr += l.credit;
    }
  }
  const trialBalanceDifference = roundKes(dr - cr);

  // Unreconciled bank/M-Pesa statement lines.
  const lines = await ctx.db.query("bankLines").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const unreconciledBankTransactions = lines.filter(
    (l) => l.status !== "reconciled" && l.status !== "ignored" && l.status !== "matched"
  ).length;

  // Outstanding AR / AP.
  const invoices = await ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  let outstandingAR = 0;
  for (const inv of invoices) {
    if (["draft", "cancelled", "void"].includes(inv.status)) continue;
    outstandingAR += inv.total - (inv.amountPaid ?? 0);
  }
  const bills = await ctx.db.query("bills").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  let outstandingAP = 0;
  for (const b of bills) {
    if (["draft", "void"].includes(b.status)) continue;
    outstandingAP += b.amount - (b.amountPaid ?? 0);
  }

  // Payroll for the period.
  const month = Number(period.slice(5, 7));
  const year = Number(period.slice(0, 4));
  const payrolls = await ctx.db.query("payrolls").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const payrollRuns = payrolls.filter((p) => p.month === month && p.year === year).length;

  // Unposted depreciation: active assets without a depreciation entry this period.
  const assets = await ctx.db.query("fixedAssets").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  let unpostedDepreciation = 0;
  for (const a of assets) {
    if (a.status !== "active") continue;
    const posted = journals.find(
      (j) => j.source === "depreciation" && j.sourceId === `${a._id}:${period}` && !j.reversedBy
    );
    if (!posted) unpostedDepreciation += 1;
  }

  // VAT payable for the period (output − input).
  let vatOutput = 0;
  let vatInput = 0;
  for (const j of journals) {
    if (!j.date.startsWith(period)) continue;
    if (j.reversedBy) continue;
    for (const l of j.lines) {
      if (l.accountCode === "2150") vatOutput += l.credit - l.debit;
      if (l.accountCode === "1150") vatInput += l.debit - l.credit;
    }
  }
  const vatPayable = roundKes(vatOutput - vatInput);

  const critical = trialBalanceDifference !== 0;
  return {
    period,
    through,
    trialBalanceDifference,
    unreconciledBankTransactions,
    outstandingAR: roundKes(outstandingAR),
    outstandingAP: roundKes(outstandingAP),
    payrollRuns,
    unpostedPayroll: payrollRuns === 0,
    unpostedDepreciation,
    vatPayable,
    draftInvoices: invoices.filter((i) => i.status === "draft").length,
    draftBills: bills.filter((b) => b.status === "draft").length,
    draftJournals,
    critical,
  };
}

export const getChecklist = query({
  args: { secret: v.string(), orgId: v.id("organizations"), period: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    // Seed on read via a no-op lookup is not possible in a query; callers use
    // ensureChecklist mutation first. Return whatever exists plus the summary.
    const tasks = await ctx.db
      .query("closeTasks")
      .withIndex("by_org_period", (q) => q.eq("orgId", args.orgId).eq("period", args.period))
      .collect();
    const summary = await buildSummary(ctx, args.orgId, args.period);
    return { tasks: tasks.sort((a, b) => a.label.localeCompare(b.label)), summary };
  },
});

export const ensureChecklistMutation = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), period: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await ensureChecklist(ctx, args.orgId, args.period);
    return true;
  },
});

export const setTaskStatus = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    period: v.string(),
    key: v.string(),
    status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("complete"), v.literal("blocked")),
    note: v.optional(v.string()),
    updatedBy: v.optional(v.id("users")),
    updatedByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await ensureChecklist(ctx, args.orgId, args.period);
    const task = await ctx.db
      .query("closeTasks")
      .withIndex("by_org_period", (q) => q.eq("orgId", args.orgId).eq("period", args.period))
      .collect()
      .then((rows) => rows.find((r) => r.key === args.key));
    if (!task) throw new Error("Checklist item not found");
    await ctx.db.patch(task._id, {
      status: args.status,
      note: args.note?.trim() || undefined,
      updatedBy: args.updatedBy,
      updatedByName: args.updatedByName,
      updatedAt: tsNow(),
    });
    return true;
  },
});

export const closeSummary = query({
  args: { secret: v.string(), orgId: v.id("organizations"), period: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return buildSummary(ctx, args.orgId, args.period);
  },
});

export const setPeriodStatus = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    period: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("pending_close"),
      v.literal("closed"),
      v.literal("locked"),
      v.literal("future")
    ),
    byName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db
      .query("accountingPeriods")
      .withIndex("by_org_period", (q) => q.eq("orgId", args.orgId).eq("period", args.period))
      .first();
    if (!row) throw new Error("Period not found");
    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "locked") {
      patch.lockedAt = new Date().toISOString().slice(0, 10);
    } else if (args.status === "open" || args.status === "pending_close") {
      patch.lockedAt = undefined;
      patch.lockedBy = undefined;
    }
    await ctx.db.patch(row._id, patch);
    return { period: args.period, status: args.status };
  },
});

/** Close a period, guarding critical integrity checks. */
export const closePeriod = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    period: v.string(),
    force: v.optional(v.boolean()),
    closedBy: v.optional(v.id("users")),
    closedByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await ensureChecklist(ctx, args.orgId, args.period);
    const summary = await buildSummary(ctx, args.orgId, args.period);
    if (summary.critical && !args.force) {
      throw new Error(
        `Cannot close ${args.period}: the trial balance is out of balance by ${summary.trialBalanceDifference}. ` +
          `Correct it with an adjustment journal, or force close if this is intentional.`
      );
    }
    const row = await ctx.db
      .query("accountingPeriods")
      .withIndex("by_org_period", (q) => q.eq("orgId", args.orgId).eq("period", args.period))
      .first();
    if (!row) throw new Error("Period not found");
    await ctx.db.patch(row._id, { status: "closed" });
    return { period: args.period, status: "closed", summary };
  },
});
