import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { assertSecret, tsNow, fmtCreated } from "./lib";
import { tryPostJournalForSource } from "./accounting";

type BillDoc = Doc<"bills">;

async function enrichBill(ctx: QueryCtx, b: BillDoc) {
  const contact = await ctx.db.get(b.contactId);
  const rate = b.vatRate ?? 0;
  const vat = rate > 0 ? Math.round((b.amount - b.amount / (1 + rate / 100)) * 100) / 100 : 0;
  const net = Math.round((b.amount - vat) * 100) / 100;
  return {
    id: b._id,
    contact_id: b.contactId,
    contact_name: contact?.name ?? "—",
    contact_company: contact?.company ?? null,
    contact_email: contact?.email ?? null,
    contact_phone: contact?.phone ?? null,
    number: b.number,
    bill_date: b.billDate,
    due_date: b.dueDate,
    amount: b.amount,
    vat_rate: rate,
    net_amount: net,
    vat_amount: vat,
    amount_paid: b.amountPaid ?? 0,
    balance_due: Math.round((b.amount - (b.amountPaid ?? 0)) * 100) / 100,
    cost_center_code: b.costCenterCode ?? null,
    project_id: b.projectId ?? null,
    description: b.description ?? null,
    status: b.status,
    paid_at: b.paidAt ?? null,
    created_by: b.createdBy,
    created_at: fmtCreated(b.createdAt),
    updated_at: fmtCreated(b.updatedAt),
  };
}

async function nextBillNumber(ctx: MutationCtx | QueryCtx, orgId: Id<"organizations">): Promise<string> {
  const all = await ctx.db.query("bills").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  return `BL-${String(all.length + 1).padStart(4, "0")}`;
}

export const listBills = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db.query("bills").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(sorted.map((d) => enrichBill(ctx, d)));
  },
});

export const getBill = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("bills") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return enrichBill(ctx, doc);
  },
});

export const createBill = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    billDate: v.string(),
    dueDate: v.string(),
    amount: v.number(),
    vatRate: v.optional(v.number()),
    description: v.optional(v.string()),
    costCenterCode: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.orgId !== args.orgId) throw new Error("Supplier not found");
    if (contact.type !== "supplier") throw new Error("Bills must reference a supplier contact");
    if (!(args.amount > 0)) throw new Error("Amount must be greater than zero");
    const rate = Math.max(0, Math.min(100, args.vatRate ?? 0));
    const number = await nextBillNumber(ctx, args.orgId);
    const id = await ctx.db.insert("bills", {
      orgId: args.orgId,
      contactId: args.contactId,
      number,
      billDate: args.billDate,
      dueDate: args.dueDate,
      amount: args.amount,
      vatRate: rate,
      description: args.description?.trim() || undefined,
      status: "pending",
      amountPaid: 0,
      costCenterCode: args.costCenterCode || undefined,
      projectId: args.projectId,
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });

    // Auto-post: supplier bill increases expenses and accounts payable.
    // When VAT applies, the gross amount is split into a net expense and
    // recoverable input VAT (account 1150) so the VAT return is correct.
    const vat = rate > 0 ? Math.round((args.amount - args.amount / (1 + rate / 100)) * 100) / 100 : 0;
    const net = Math.round((args.amount - vat) * 100) / 100;
    const lines =
      vat > 0
        ? [
            { accountCode: "5990", debit: net, credit: 0, memo: number, costCenterCode: args.costCenterCode, projectId: args.projectId as never },
            { accountCode: "1150", debit: vat, credit: 0, memo: "VAT input", costCenterCode: args.costCenterCode, projectId: args.projectId as never },
            { accountCode: "2000", debit: 0, credit: args.amount, memo: number, costCenterCode: args.costCenterCode, projectId: args.projectId as never },
          ]
        : [
            { accountCode: "5990", debit: args.amount, credit: 0, memo: number, costCenterCode: args.costCenterCode, projectId: args.projectId as never },
            { accountCode: "2000", debit: 0, credit: args.amount, memo: number, costCenterCode: args.costCenterCode, projectId: args.projectId as never },
          ];
    await tryPostJournalForSource(ctx, {
      orgId: args.orgId,
      source: "bill",
      sourceId: id,
      date: args.billDate,
      description: `Bill ${number}`,
      lines,
      postedByName: "Auto (bill recorded)",
    });
    return id;
  },
});

export const updateBill = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("bills"),
    contactId: v.optional(v.id("contacts")),
    billDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    amount: v.optional(v.number()),
    vatRate: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Bill not found");
    if ((doc.amountPaid ?? 0) > 0) {
      throw new Error("This bill has payments applied — void the payment(s) before editing.");
    }
    if (doc.status === "void") throw new Error("Voided bills cannot be edited.");

    const patch: Record<string, unknown> = {};
    if (args.contactId !== undefined) {
      const contact = await ctx.db.get(args.contactId);
      if (!contact || contact.orgId !== args.orgId) throw new Error("Supplier not found");
      if (contact.type !== "supplier") throw new Error("Bills must reference a supplier contact");
      patch.contactId = args.contactId;
    }
    if (args.billDate !== undefined) patch.billDate = args.billDate;
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    if (args.amount !== undefined) {
      if (!(args.amount > 0)) throw new Error("Amount must be greater than zero");
      patch.amount = args.amount;
    }
    if (args.description !== undefined) patch.description = args.description?.trim() || undefined;
    if (args.vatRate !== undefined) patch.vatRate = Math.max(0, Math.min(100, args.vatRate));
    patch.updatedAt = tsNow();
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const setBillStatus = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("bills"),
    status: v.union(
      v.literal("draft"),
      v.literal("received"),
      v.literal("pending"),
      v.literal("partially_paid"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("void")
    ),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new ConvexError("Bill not found");
    // Settlement happens through a supplier payment — never mark paid directly.
    if (args.status === "paid" || args.status === "partially_paid") {
      throw new ConvexError(
        "Record a supplier payment to settle this bill. Bills cannot be marked paid directly."
      );
    }
    if (doc.status === "void") throw new ConvexError("Voided bills cannot be changed.");
    await ctx.db.patch(args.id, { status: args.status, updatedAt: tsNow() });
    return true;
  },
});

export const deleteBill = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("bills") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Bill not found");
    await ctx.db.delete(args.id);
    return true;
  },
});
