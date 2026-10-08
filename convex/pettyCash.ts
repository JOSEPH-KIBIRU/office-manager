import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { assertSecret, tsNow, tsString, fmtCreated, requireMember } from "./lib";
import { tryPostJournalForSource } from "./accounting";
import { notifyStaff, pushNotification } from "./notifications";

type PettyDoc = Doc<"pettyCash">;

// Petty cash requests at or below this amount are auto-approved; anything
// higher requires manager/admin approval.
const AUTO_APPROVE_LIMIT = 5000;

async function enrich(ctx: QueryCtx, p: PettyDoc) {
  const requester = await ctx.db.get(p.requestedBy);
  const approver = p.approvedBy ? await ctx.db.get(p.approvedBy) : null;
  return {
    id: p._id,
    requested_by: p.requestedBy,
    requisition_no: p.requisitionNo ?? null,
    requested_by_name: requester?.name ?? null,
    approved_by_name: approver?.name ?? null,
    amount: p.amount,
    purpose: p.purpose,
    date_needed: p.dateNeeded,
    status: p.status,
    approved_at: p.approvedAt ?? null,
    paid_at: p.paidAt ?? null,
    note: p.note ?? null,
    created_at: fmtCreated(p.createdAt),
  };
}

export const listPettyCash = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (args.userId) await requireMember(ctx, args.orgId, args.userId);
    const all = await ctx.db
      .query("pettyCash")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const docs = args.userId
      ? all.filter((p) => p.requestedBy === args.userId)
      : all;
    const sorted = [...docs].sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(sorted.map((d) => enrich(ctx, d)));
  },
});

export const getPettyCash = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("pettyCash") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return enrich(ctx, doc);
  },
});

export const createPettyCash = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    requestedBy: v.id("users"),
    amount: v.number(),
    purpose: v.string(),
    dateNeeded: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const existing = await ctx.db
      .query("pettyCash")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const reqNo = `RQ-PC-${String(existing.length + 1).padStart(4, "0")}`;
    const requester = await ctx.db.get(args.requestedBy);
    const id = await ctx.db.insert("pettyCash", {
      orgId: args.orgId,
      requestedBy: args.requestedBy,
      amount: args.amount,
      purpose: args.purpose,
      dateNeeded: args.dateNeeded,
      status: "pending",
      createdAt: tsNow(),
      requisitionNo: reqNo,
    });
    await notifyStaff(ctx, args.orgId, {
      userId: args.requestedBy as unknown as string,
      type: "petty",
      title: "New petty cash request",
      body: `${requester?.name ?? "Someone"} requested KSh ${args.amount} for ${args.purpose}.`,
      link: "/petty-cash",
    });
    return id;
  },
});

/**
 * Create several petty cash lines at once. Each line is auto-approved when its
 * amount is at or below AUTO_APPROVE_LIMIT, otherwise it is left pending for
 * manager/admin review. Returns the created rows (enriched).
 */
export const createPettyCashBatch = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    requestedBy: v.id("users"),
    items: v.array(
      v.object({
        amount: v.number(),
        purpose: v.string(),
        dateNeeded: v.string(),
        costCenterCode: v.optional(v.string()),
        projectId: v.optional(v.id("projects")),
      })
    ),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (args.items.length === 0) throw new Error("At least one line item is required");
    if (args.items.length > 50) throw new Error("Too many line items (max 50)");

    const existing = await ctx.db
      .query("pettyCash")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const startNo = existing.length + 1;

    const requester = await ctx.db.get(args.requestedBy);
    const created: string[] = [];

    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      if (item.amount <= 0) throw new Error(`Line ${i + 1}: amount must be greater than zero`);
      if (!item.purpose.trim()) throw new Error(`Line ${i + 1}: purpose is required`);
      const autoApproved = item.amount <= AUTO_APPROVE_LIMIT;
      const reqNo = `RQ-PC-${String(startNo + i).padStart(4, "0")}`;

      const id = await ctx.db.insert("pettyCash", {
        orgId: args.orgId,
        requestedBy: args.requestedBy,
        amount: item.amount,
        purpose: item.purpose.trim(),
        dateNeeded: item.dateNeeded,
        status: autoApproved ? "approved" : "pending",
        approvedBy: autoApproved ? args.requestedBy : undefined,
        approvedAt: autoApproved ? tsString() : undefined,
        requisitionNo: reqNo,
        costCenterCode: item.costCenterCode || undefined,
        projectId: item.projectId,
        createdAt: tsNow(),
      });
      created.push(id);

      if (autoApproved) {
        await tryPostJournalForSource(ctx, {
          orgId: args.orgId,
          source: "petty_cash",
          sourceId: id,
          date: item.dateNeeded,
          description: `Petty cash ${reqNo} · ${item.purpose}`,
          lines: [
            { accountCode: "5990", debit: item.amount, credit: 0, memo: reqNo, costCenterCode: item.costCenterCode, projectId: item.projectId as never },
            { accountCode: "1010", debit: 0, credit: item.amount, memo: reqNo, costCenterCode: item.costCenterCode, projectId: item.projectId as never },
          ],
          postedByName: "Auto (petty cash approved)",
        });
      }

      await pushNotification(ctx, args.orgId as unknown as string, {
        userId: args.requestedBy as unknown as string,
        type: "petty",
        title: autoApproved ? "Petty cash auto-approved" : "Petty cash needs approval",
        body: autoApproved
          ? `Your request for KSh ${item.amount} (${item.purpose}) was auto-approved (within the KSh ${AUTO_APPROVE_LIMIT.toLocaleString()} limit).`
          : `Your request for KSh ${item.amount} (${item.purpose}) is pending manager approval.`,
        link: "/petty-cash",
      });
    }

    await notifyStaff(ctx, args.orgId, {
      userId: args.requestedBy as unknown as string,
      type: "petty",
      title: `Petty cash request: ${created.length} line${created.length > 1 ? "s" : ""}`,
      body: `${requester?.name ?? "Someone"} submitted ${created.length} petty cash line(s).`,
      link: "/petty-cash",
    });

    return { ids: created };
  },
});

export const reviewPettyCash = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("pettyCash"),
    action: v.union(v.literal("approve"), v.literal("reject"), v.literal("paid")),
    reviewerId: v.optional(v.id("users")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== args.orgId) throw new Error("Petty cash request not found");

    if (args.action === "approve") {
      if (row.status !== "pending") throw new Error(`Already ${row.status}`);
      await ctx.db.patch(row._id, {
        status: "approved",
        approvedBy: args.reviewerId,
        approvedAt: tsString(),
        note: args.note ?? row.note,
      });
      await tryPostJournalForSource(ctx, {
        orgId: args.orgId,
        source: "petty_cash",
        sourceId: row._id,
        date: row.dateNeeded,
        description: `Petty cash ${row.requisitionNo ?? ""} · ${row.purpose}`.trim(),
        lines: [
          { accountCode: "5990", debit: row.amount, credit: 0, memo: row.requisitionNo ?? undefined, costCenterCode: row.costCenterCode, projectId: row.projectId as never },
          { accountCode: "1010", debit: 0, credit: row.amount, memo: row.requisitionNo ?? undefined, costCenterCode: row.costCenterCode, projectId: row.projectId as never },
        ],
        postedByName: "Auto (petty cash approved)",
      });
      await pushNotification(ctx, args.orgId as unknown as string, {
        userId: row.requestedBy as unknown as string,
        type: "petty",
        title: "Petty cash approved",
        body: `Your request for KSh ${row.amount} (${row.purpose}) was approved.`,
        link: "/petty-cash",
      });
    } else if (args.action === "reject") {
      if (row.status !== "pending") throw new Error(`Already ${row.status}`);
      await ctx.db.patch(row._id, {
        status: "rejected",
        approvedBy: args.reviewerId,
        approvedAt: tsString(),
        note: args.note ?? row.note,
      });
      await pushNotification(ctx, args.orgId as unknown as string, {
        userId: row.requestedBy as unknown as string,
        type: "petty",
        title: "Petty cash declined",
        body: `Your request for KSh ${row.amount} (${row.purpose}) was declined.`,
        link: "/petty-cash",
      });
    } else if (args.action === "paid") {
      if (row.status !== "approved") throw new Error("Only approved requests can be marked as paid");
      await ctx.db.patch(row._id, { status: "paid", paidAt: tsString() });
      await pushNotification(ctx, args.orgId as unknown as string, {
        userId: row.requestedBy as unknown as string,
        type: "petty",
        title: "Petty cash paid out",
        body: `Your petty cash of KSh ${row.amount} (${row.purpose}) has been disbursed.`,
        link: "/petty-cash",
      });
    }
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Monthly petty-cash allocation (budget) + float funding
 * ------------------------------------------------------------------ */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Monthly allocation vs spend for a period (YYYY-MM). */
export const getBudget = query({
  args: { secret: v.string(), orgId: v.id("organizations"), period: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const budget = await ctx.db
      .query("pettyCashBudgets")
      .withIndex("by_org_period", (q) => q.eq("orgId", args.orgId).eq("period", args.period))
      .first();
    const all = await ctx.db.query("pettyCash").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const month = all.filter((p) => (p.dateNeeded ?? "").slice(0, 7) === args.period);
    const spent = month
      .filter((p) => p.status === "approved" || p.status === "paid")
      .reduce((s, p) => s + p.amount, 0);
    const pending = month.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const amount = round2(budget?.amount ?? 0);
    return {
      period: args.period,
      amount,
      spent: round2(spent),
      pending: round2(pending),
      remaining: round2(amount - spent),
      set_at: budget ? fmtCreated(budget.setAt) : null,
    };
  },
});

/** Post the float funding/adjustment transfer (Dr Petty cash / Cr Bank). */
async function fundFloat(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  period: string,
  delta: number,
  suffix: string
) {
  const amt = Math.abs(round2(delta));
  if (amt === 0) return;
  const date = `${period}-01`;
  const lines =
    delta > 0
      ? [
          { accountCode: "1010", debit: amt, credit: 0, memo: "Petty cash float" },
          { accountCode: "1020", debit: 0, credit: amt, memo: "Petty cash float" },
        ]
      : [
          { accountCode: "1020", debit: amt, credit: 0, memo: "Petty cash float adjustment" },
          { accountCode: "1010", debit: 0, credit: amt, memo: "Petty cash float adjustment" },
        ];
  await tryPostJournalForSource(ctx, {
    orgId,
    source: "petty_cash_fund",
    sourceId: `budget${suffix}`,
    date,
    description: `Petty cash allocation ${period}`,
    lines,
    postedByName: "Auto (petty cash allocation)",
  });
}

/** Set/update the monthly petty-cash allocation (funds the float in the ledger). */
export const setBudget = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    period: v.string(),
    amount: v.number(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (!/^\d{4}-\d{2}$/.test(args.period)) throw new ConvexError("Invalid month");
    if (!(args.amount >= 0) || args.amount > 100_000_000) throw new ConvexError("Enter a valid amount");
    await requireMember(ctx, args.orgId, args.userId);

    const now = tsNow();
    const existing = await ctx.db
      .query("pettyCashBudgets")
      .withIndex("by_org_period", (q) => q.eq("orgId", args.orgId).eq("period", args.period))
      .first();

    if (!existing) {
      const id = await ctx.db.insert("pettyCashBudgets", {
        orgId: args.orgId,
        period: args.period,
        amount: round2(args.amount),
        setBy: args.userId,
        setAt: now,
        updatedAt: now,
      });
      await fundFloat(ctx, args.orgId, args.period, args.amount, `:${id}`);
      return id;
    }

    const delta = round2(args.amount - existing.amount);
    await ctx.db.patch(existing._id, { amount: round2(args.amount), setBy: args.userId, updatedAt: now });
    if (delta !== 0) {
      await fundFloat(ctx, args.orgId, args.period, delta, `:${existing._id}:${existing.amount}->${args.amount}`);
    }
    return existing._id;
  },
});
