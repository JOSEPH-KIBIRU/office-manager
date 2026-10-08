import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertSecret, tsNow } from "./lib";
import { postJournalForSource, resolveControlCode, roundKes } from "./accounting";

/**
 * Recurring bills / expenses / journals. Each scheduled run posts a balanced
 * journal through the engine (idempotent per template + run date), so a
 * re-run never duplicates an entry.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function advance(date: string, frequency: string): string {
  if (frequency === "weekly") return addDays(date, 7);
  const d = new Date(date + "T00:00:00Z");
  const months = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const listRecurring = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("recurringTransactions").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return rows.sort((a, b) => a.nextRun.localeCompare(b.nextRun));
  },
});

export const createRecurring = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    kind: v.union(v.literal("bill"), v.literal("expense"), v.literal("journal")),
    name: v.string(),
    description: v.optional(v.string()),
    frequency: v.union(v.literal("weekly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly")),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    amount: v.number(),
    accountCode: v.optional(v.string()),
    costCenterCode: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    vatRate: v.optional(v.number()),
    taxTreatment: v.optional(v.string()),
    supplierId: v.optional(v.id("contacts")),
    lines: v.optional(
      v.array(v.object({ accountCode: v.string(), debit: v.number(), credit: v.number(), memo: v.optional(v.string()) }))
    ),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (!args.name.trim()) throw new Error("Name is required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate)) throw new Error("A valid start date is required");
    if (args.kind === "journal") {
      if (!args.lines || args.lines.length < 2) throw new Error("A recurring journal needs at least two lines");
    } else if (!(args.amount > 0)) {
      throw new Error("Amount must be greater than zero");
    }
    const id = await ctx.db.insert("recurringTransactions", {
      orgId: args.orgId,
      kind: args.kind,
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      frequency: args.frequency,
      startDate: args.startDate,
      endDate: args.endDate || undefined,
      nextRun: args.startDate,
      amount: round2(args.amount ?? 0),
      accountCode: args.accountCode || undefined,
      costCenterCode: args.costCenterCode || undefined,
      projectId: args.projectId,
      vatRate: args.vatRate,
      taxTreatment: args.taxTreatment || undefined,
      supplierId: args.supplierId,
      lines: args.lines,
      active: true,
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
    return { id };
  },
});

export const updateRecurring = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("recurringTransactions"),
    active: v.optional(v.boolean()),
    amount: v.optional(v.number()),
    endDate: v.optional(v.string()),
    nextRun: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Recurring transaction not found");
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.active !== undefined) patch.active = args.active;
    if (args.amount !== undefined) patch.amount = round2(args.amount);
    if (args.endDate !== undefined) patch.endDate = args.endDate || undefined;
    if (args.nextRun !== undefined) patch.nextRun = args.nextRun;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const deleteRecurring = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("recurringTransactions") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Recurring transaction not found");
    await ctx.db.delete(args.id);
    return true;
  },
});

/** Process all templates due up to `asOf` (defaults to today). */
export const runRecurring = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    asOf: v.optional(v.string()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const asOf = args.asOf || today();
    const rows = await ctx.db.query("recurringTransactions").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    let processed = 0;
    let total = 0;
    const skipped: string[] = [];

    for (const rec of rows) {
      if (!rec.active) continue;
      let guard = 0;
      try {
        while (rec.nextRun <= asOf && (!rec.endDate || rec.nextRun <= rec.endDate) && guard < 120) {
          guard += 1;
          const runDate = rec.nextRun;
          const lines = await buildLines(ctx, args.orgId, rec);
          if (lines.length >= 2) {
            await postJournalForSource(ctx, {
              orgId: args.orgId,
              source: "recurring",
              sourceId: `${rec._id}:${runDate}`,
              date: runDate,
              description: `${rec.name}${rec.description ? ` — ${rec.description}` : ""}`,
              lines,
              postedByName: args.createdByName ?? "Recurring",
            });
            processed += 1;
            total = round2(total + rec.amount);
          }
          // Advance and persist after each run.
          const next = advance(runDate, rec.frequency);
          await ctx.db.patch(rec._id, { nextRun: next, lastRunAt: runDate, updatedAt: tsNow() });
          rec.nextRun = next;
        }
      } catch (e) {
        // One bad template must not abort the rest; report and continue.
        skipped.push(`${rec.name}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
    return { processed, total, skipped };
  },
});

async function buildLines(ctx: MutationCtx, orgId: Id<"organizations">, rec: any) {
  if (rec.kind === "journal") {
    return (rec.lines ?? []).map((l: any) => ({
      accountCode: l.accountCode,
      debit: round2(l.debit),
      credit: round2(l.credit),
      memo: l.memo,
    }));
  }
  const rate = Math.max(0, Math.min(100, rec.vatRate ?? 0));
  const vat = rate > 0 ? round2(rec.amount - rec.amount / (1 + rate / 100)) : 0;
  const net = round2(rec.amount - vat);
  const expense = rec.accountCode || "5990";
  const vatIn = await resolveControlCode(ctx, orgId, "vat_input");
  const credit = rec.kind === "bill"
    ? await resolveControlCode(ctx, orgId, "ap")
    : await resolveControlCode(ctx, orgId, "bank");
  const lines = [{ accountCode: expense, debit: net, credit: 0, memo: rec.name, costCenterCode: rec.costCenterCode, projectId: rec.projectId }];
  if (vat > 0) lines.push({ accountCode: vatIn, debit: vat, credit: 0, memo: "Input VAT", costCenterCode: rec.costCenterCode, projectId: rec.projectId } as never);
  lines.push({ accountCode: credit, debit: 0, credit: rec.amount, memo: rec.name, costCenterCode: rec.costCenterCode, projectId: rec.projectId } as never);
  return lines;
}
