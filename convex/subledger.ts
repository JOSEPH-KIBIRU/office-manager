import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertSecret, tsNow } from "./lib";
import {
  postJournalForSource,
  reverseJournalInternal,
  resolveControlCode,
  resolveCashAccount,
  roundKes,
} from "./accounting";

/**
 * Accounts Receivable / Accounts Payable sub-ledger.
 *
 * The double-entry journal remains the source of truth; receipts, payments and
 * credit notes all post through `postJournalForSource` and simply add an
 * open-item layer (allocations) on top. Balances are always derived, never
 * stored as mutable "balance" fields.
 */

type PayMethod = "bank" | "mpesa" | "cash";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(later: string, earlier: string): number {
  const a = Date.parse(later + "T00:00:00Z");
  const b = Date.parse(earlier + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((a - b) / 86_400_000);
}

async function allocatedTo(
  ctx: MutationCtx | QueryCtx,
  field: "invoiceId" | "billId",
  id: string
): Promise<number> {
  const rows = await ctx.db
    .query("allocations")
    .withIndex(field === "invoiceId" ? "by_invoice" : "by_bill", (q) => q.eq(field, id as never))
    .collect();
  return roundKes(rows.reduce((s, a) => s + a.amount, 0));
}

function deriveInvoiceStatus(current: string, total: number, paid: number, dueDate: string): string {
  if (current === "draft" || current === "cancelled" || current === "void") return current;
  if (paid >= total - 0.5) return "paid";
  if (paid > 0) return "partially_paid";
  return dueDate < today() ? "overdue" : "sent";
}

function deriveBillStatus(current: string, total: number, paid: number, dueDate: string): string {
  if (current === "draft" || current === "void") return current;
  if (paid >= total - 0.5) return "paid";
  if (paid > 0) return "partially_paid";
  if (current === "received") return dueDate < today() ? "overdue" : "received";
  return dueDate < today() ? "overdue" : "pending";
}

async function recomputeInvoice(ctx: MutationCtx, id: Id<"invoices">): Promise<void> {
  const inv = await ctx.db.get(id);
  if (!inv) return;
  const paid = await allocatedTo(ctx, "invoiceId", id);
  await ctx.db.patch(id, {
    amountPaid: paid,
    status: deriveInvoiceStatus(inv.status, inv.total, paid, inv.dueDate) as never,
    updatedAt: tsNow(),
  });
}

async function recomputeBill(ctx: MutationCtx, id: Id<"bills">): Promise<void> {
  const bill = await ctx.db.get(id);
  if (!bill) return;
  const paid = await allocatedTo(ctx, "billId", id);
  const status = deriveBillStatus(bill.status, bill.amount, paid, bill.dueDate);
  await ctx.db.patch(id, {
    amountPaid: paid,
    status: status as never,
    paidAt: status === "paid" ? bill.paidAt ?? new Date().toISOString().replace("T", " ").slice(0, 19) : undefined,
    updatedAt: tsNow(),
  });
}

async function assertPeriodOpenForDate(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  date: string
): Promise<void> {
  // postJournalForSource enforces this too; an explicit check gives a clearer error.
  const period = date.slice(0, 7);
  const row = await ctx.db
    .query("accountingPeriods")
    .withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("period", period))
    .first();
  if (row && row.status === "locked") throw new Error(`${row.label} is locked — cannot post.`);
}

/* ------------------------------------------------------------------ *
 * Open items
 * ------------------------------------------------------------------ */

async function openInvoiceRows(ctx: QueryCtx, orgId: Id<"organizations">, contactId?: Id<"contacts">) {
  const all = await ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const rows = [];
  for (const inv of all) {
    if (contactId && inv.contactId !== contactId) continue;
    if (["draft", "cancelled", "void"].includes(inv.status)) continue;
    const paid = await allocatedTo(ctx, "invoiceId", inv._id);
    const balance = roundKes(inv.total - paid);
    if (balance <= 0) continue;
    const contact = await ctx.db.get(inv.contactId);
    const ageDays = daysBetween(today(), inv.dueDate);
    rows.push({
      id: inv._id,
      number: inv.number,
      contactId: inv.contactId,
      contactName: contact?.name ?? "—",
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      total: inv.total,
      subtotal: inv.subtotal,
      taxTotal: inv.taxTotal,
      amountPaid: paid,
      balanceDue: balance,
      ageDays,
      status: deriveInvoiceStatus(inv.status, inv.total, paid, inv.dueDate),
    });
  }
  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

async function openBillRows(ctx: QueryCtx, orgId: Id<"organizations">, contactId?: Id<"contacts">) {
  const all = await ctx.db.query("bills").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const rows = [];
  for (const bill of all) {
    if (contactId && bill.contactId !== contactId) continue;
    if (["draft", "void"].includes(bill.status)) continue;
    const paid = await allocatedTo(ctx, "billId", bill._id);
    const balance = roundKes(bill.amount - paid);
    if (balance <= 0) continue;
    const contact = await ctx.db.get(bill.contactId);
    const ageDays = daysBetween(today(), bill.dueDate);
    rows.push({
      id: bill._id,
      number: bill.number,
      contactId: bill.contactId,
      contactName: contact?.name ?? "—",
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      amount: bill.amount,
      vatRate: bill.vatRate ?? 0,
      amountPaid: paid,
      balanceDue: balance,
      ageDays,
      status: deriveBillStatus(bill.status, bill.amount, paid, bill.dueDate),
    });
  }
  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export const listOpenInvoices = query({
  args: { secret: v.string(), orgId: v.id("organizations"), contactId: v.optional(v.id("contacts")) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return openInvoiceRows(ctx, args.orgId, args.contactId ?? undefined);
  },
});

export const listOpenBills = query({
  args: { secret: v.string(), orgId: v.id("organizations"), contactId: v.optional(v.id("contacts")) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return openBillRows(ctx, args.orgId, args.contactId ?? undefined);
  },
});

/* ------------------------------------------------------------------ *
 * Receipts & payments
 * ------------------------------------------------------------------ */

export const createReceipt = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    date: v.string(),
    amount: v.number(),
    method: v.union(v.literal("bank"), v.literal("mpesa"), v.literal("cash")),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    allocations: v.array(v.object({ invoiceId: v.id("invoices"), amount: v.number() })),
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.orgId !== args.orgId) throw new Error("Customer not found");
    if (contact.type !== "customer") throw new Error("Receipts must reference a customer.");
    if (!(args.amount > 0)) throw new Error("Amount must be greater than zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("A valid receipt date is required.");

    const allocTotal = roundKes(args.allocations.reduce((s, a) => s + a.amount, 0));
    if (allocTotal > args.amount + 0.5) throw new Error("Allocations cannot exceed the receipt amount.");
    for (const a of args.allocations) {
      if (!(a.amount > 0)) throw new Error("Allocation amounts must be positive.");
      const inv = await ctx.db.get(a.invoiceId);
      if (!inv || inv.orgId !== args.orgId) throw new Error("Invoice not found.");
      if (inv.contactId !== args.contactId) throw new Error("Invoice belongs to a different customer.");
    }

    await assertPeriodOpenForDate(ctx, args.orgId, args.date);
    const cash = await resolveCashAccount(ctx, args.orgId, args.method);
    const ar = await resolveControlCode(ctx, args.orgId, "ar");

    const paymentId = await ctx.db.insert("payments", {
      orgId: args.orgId,
      contactId: args.contactId,
      kind: "receipt",
      date: args.date,
      amount: roundKes(args.amount),
      method: args.method,
      accountCode: cash,
      reference: args.reference?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      createdBy: args.createdBy,
      createdByName: args.createdByName,
      createdAt: tsNow(),
    });

    const journalId = await postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "receipt",
      sourceId: paymentId,
      date: args.date,
      description: `Receipt from ${contact.name}${args.reference ? ` · ${args.reference}` : ""}`,
      lines: [
        { accountCode: cash, debit: args.amount, credit: 0, memo: args.reference },
        { accountCode: ar, debit: 0, credit: args.amount, memo: args.reference },
      ],
      postedBy: args.createdBy,
      postedByName: args.createdByName ?? "Receipt",
    });
    await ctx.db.patch(paymentId, { journalId });

    for (const a of args.allocations) {
      await ctx.db.insert("allocations", {
        orgId: args.orgId,
        invoiceId: a.invoiceId,
        amount: roundKes(a.amount),
        paymentId,
        createdAt: tsNow(),
      });
      await recomputeInvoice(ctx, a.invoiceId);
    }
    return { paymentId, journalId };
  },
});

export const createPayment = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    date: v.string(),
    amount: v.number(),
    method: v.union(v.literal("bank"), v.literal("mpesa"), v.literal("cash")),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    allocations: v.array(v.object({ billId: v.id("bills"), amount: v.number() })),
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const supplier = await ctx.db.get(args.contactId);
    if (!supplier || supplier.orgId !== args.orgId) throw new Error("Supplier not found");
    if (supplier.type !== "supplier") throw new Error("Payments must reference a supplier.");
    if (!(args.amount > 0)) throw new Error("Amount must be greater than zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("A valid payment date is required.");

    const allocTotal = roundKes(args.allocations.reduce((s, a) => s + a.amount, 0));
    if (allocTotal > args.amount + 0.5) throw new Error("Allocations cannot exceed the payment amount.");
    for (const a of args.allocations) {
      if (!(a.amount > 0)) throw new Error("Allocation amounts must be positive.");
      const bill = await ctx.db.get(a.billId);
      if (!bill || bill.orgId !== args.orgId) throw new Error("Bill not found.");
      if (bill.contactId !== args.contactId) throw new Error("Bill belongs to a different supplier.");
    }

    await assertPeriodOpenForDate(ctx, args.orgId, args.date);
    const cash = await resolveCashAccount(ctx, args.orgId, args.method);
    const ap = await resolveControlCode(ctx, args.orgId, "ap");

    const paymentId = await ctx.db.insert("payments", {
      orgId: args.orgId,
      contactId: args.contactId,
      kind: "payment",
      date: args.date,
      amount: roundKes(args.amount),
      method: args.method,
      accountCode: cash,
      reference: args.reference?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      createdBy: args.createdBy,
      createdByName: args.createdByName,
      createdAt: tsNow(),
    });

    const journalId = await postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "payment",
      sourceId: paymentId,
      date: args.date,
      description: `Payment to ${supplier.name}${args.reference ? ` · ${args.reference}` : ""}`,
      lines: [
        { accountCode: ap, debit: args.amount, credit: 0, memo: args.reference },
        { accountCode: cash, debit: 0, credit: args.amount, memo: args.reference },
      ],
      postedBy: args.createdBy,
      postedByName: args.createdByName ?? "Payment",
    });
    await ctx.db.patch(paymentId, { journalId });

    for (const a of args.allocations) {
      await ctx.db.insert("allocations", {
        orgId: args.orgId,
        billId: a.billId,
        amount: roundKes(a.amount),
        paymentId,
        createdAt: tsNow(),
      });
      await recomputeBill(ctx, a.billId);
    }
    return { paymentId, journalId };
  },
});

export const listPayments = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    kind: v.optional(v.union(v.literal("receipt"), v.literal("payment"))),
    contactId: v.optional(v.id("contacts")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db.query("payments").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const filtered = all
      .filter((p) => (!args.kind || p.kind === args.kind) && (!args.contactId || p.contactId === args.contactId))
      .sort((a, b) => b.createdAt - a.createdAt);
    const rows = [];
    for (const p of filtered) {
      const contact = await ctx.db.get(p.contactId);
      const allocs = await ctx.db.query("allocations").withIndex("by_payment", (q) => q.eq("paymentId", p._id)).collect();
      const allocated = roundKes(allocs.reduce((s, a) => s + a.amount, 0));
      rows.push({
        id: p._id,
        kind: p.kind,
        contactId: p.contactId,
        contactName: contact?.name ?? "—",
        date: p.date,
        amount: p.amount,
        method: p.method,
        accountCode: p.accountCode,
        reference: p.reference ?? null,
        notes: p.notes ?? null,
        allocated,
        unallocated: roundKes(p.amount - allocated),
        journalId: p.journalId ?? null,
        createdByName: p.createdByName ?? null,
        createdAt: p.createdAt,
      });
    }
    return rows;
  },
});

/** Void a receipt/payment: reverse the journal and unapply its allocations. */
export const voidPayment = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("payments") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const pay = await ctx.db.get(args.id);
    if (!pay || pay.orgId !== args.orgId) throw new Error("Receipt/payment not found");
    if (pay.journalId) {
      const rev = await reverseJournalInternal(ctx, {
        orgId: args.orgId,
        journalId: pay.journalId,
        date: today(),
        postedByName: "Auto (receipt/payment voided)",
      });
      if (rev === null) throw new Error("The posting period is locked — cannot void. Reverse it from the ledger instead.");
    }
    const allocs = await ctx.db.query("allocations").withIndex("by_payment", (q) => q.eq("paymentId", args.id)).collect();
    for (const a of allocs) {
      await ctx.db.delete(a._id);
      if (a.invoiceId) await recomputeInvoice(ctx, a.invoiceId);
      if (a.billId) await recomputeBill(ctx, a.billId);
    }
    await ctx.db.delete(args.id);
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Credit notes / debit notes
 * ------------------------------------------------------------------ */

async function nextCreditNoteNumber(ctx: MutationCtx, orgId: Id<"organizations">, kind: string): Promise<string> {
  const all = await ctx.db.query("creditNotes").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const prefix = kind === "sales_credit" ? "CN" : "DN";
  return `${prefix}-${String(all.length + 1).padStart(4, "0")}`;
}

export const createCreditNote = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    kind: v.union(v.literal("sales_credit"), v.literal("purchase_debit")),
    issueDate: v.string(),
    amount: v.number(),
    taxRate: v.optional(v.number()),
    reason: v.optional(v.string()),
    allocateToInvoiceId: v.optional(v.id("invoices")),
    allocateToBillId: v.optional(v.id("bills")),
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.orgId !== args.orgId) throw new Error("Contact not found");
    if (args.kind === "sales_credit" && contact.type !== "customer") throw new Error("Sales credit notes must reference a customer.");
    if (args.kind === "purchase_debit" && contact.type !== "supplier") throw new Error("Purchase debit notes must reference a supplier.");
    if (!(args.amount > 0)) throw new Error("Amount must be greater than zero.");

    const rate = Math.max(0, Math.min(100, args.taxRate ?? 0));
    const taxTotal = rate > 0 ? roundKes(args.amount - args.amount / (1 + rate / 100)) : 0;
    const subtotal = roundKes(args.amount - taxTotal);
    const number = await nextCreditNoteNumber(ctx, args.orgId, args.kind);

    const id = await ctx.db.insert("creditNotes", {
      orgId: args.orgId,
      contactId: args.contactId,
      kind: args.kind,
      number,
      issueDate: args.issueDate,
      amount: roundKes(args.amount),
      taxRate: rate,
      subtotal,
      taxTotal,
      total: roundKes(args.amount),
      reason: args.reason?.trim() || undefined,
      status: "draft",
      createdBy: args.createdBy,
      createdByName: args.createdByName,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });

    if (args.allocateToInvoiceId || args.allocateToBillId) {
      await issueCreditNoteInternal(ctx, args.orgId, id, args.allocateToInvoiceId, args.allocateToBillId);
    }
    return { id, number };
  },
});

async function issueCreditNoteInternal(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  id: Id<"creditNotes">,
  invoiceId?: Id<"invoices">,
  billId?: Id<"bills">
): Promise<void> {
  const cn = await ctx.db.get(id);
  if (!cn || cn.orgId !== orgId) throw new Error("Credit note not found");
  if (cn.status === "issued") throw new Error("This credit note has already been issued.");
  if (cn.status === "void") throw new Error("This credit note has been voided.");

  await assertPeriodOpenForDate(ctx, orgId, cn.issueDate);
  const ar = await resolveControlCode(ctx, orgId, "ar");
  const ap = await resolveControlCode(ctx, orgId, "ap");
  const vatIn = await resolveControlCode(ctx, orgId, "vat_input");
  const vatOut = await resolveControlCode(ctx, orgId, "vat_output");

  const lines =
    cn.kind === "sales_credit"
      ? [
          { accountCode: "4000", debit: cn.subtotal, credit: 0, memo: cn.number },
          ...(cn.taxTotal > 0 ? [{ accountCode: vatOut, debit: cn.taxTotal, credit: 0, memo: "VAT output reversal" }] : []),
          { accountCode: ar, debit: 0, credit: cn.total, memo: cn.number },
        ]
      : [
          { accountCode: ap, debit: cn.total, credit: 0, memo: cn.number },
          { accountCode: "5990", debit: 0, credit: cn.subtotal, memo: cn.number },
          ...(cn.taxTotal > 0 ? [{ accountCode: vatIn, debit: 0, credit: cn.taxTotal, memo: "VAT input reversal" }] : []),
        ];

  const journalId = await postJournalForSource(ctx, {
    orgId,
    source: "credit_note",
    sourceId: id,
    date: cn.issueDate,
    description: `${cn.kind === "sales_credit" ? "Credit" : "Debit"} note ${cn.number}`,
    lines,
    postedBy: cn.createdBy,
    postedByName: cn.createdByName ?? "Credit note",
  });

  await ctx.db.patch(id, { status: "issued", journalId, updatedAt: tsNow() });

  if (invoiceId) {
    const inv = await ctx.db.get(invoiceId);
    if (!inv || inv.orgId !== orgId) throw new Error("Invoice not found");
    await ctx.db.insert("allocations", {
      orgId,
      invoiceId,
      amount: cn.total,
      creditNoteId: id,
      createdAt: tsNow(),
    });
    await recomputeInvoice(ctx, invoiceId);
  }
  if (billId) {
    const bill = await ctx.db.get(billId);
    if (!bill || bill.orgId !== orgId) throw new Error("Bill not found");
    await ctx.db.insert("allocations", { orgId, billId, amount: cn.total, creditNoteId: id, createdAt: tsNow() });
    await recomputeBill(ctx, billId);
  }
}

export const issueCreditNote = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("creditNotes"),
    allocateToInvoiceId: v.optional(v.id("invoices")),
    allocateToBillId: v.optional(v.id("bills")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await issueCreditNoteInternal(ctx, args.orgId, args.id, args.allocateToInvoiceId, args.allocateToBillId);
    return true;
  },
});

/** Void an issued credit/debit note: reverse the journal and unapply allocations. */
export const voidCreditNote = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("creditNotes") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const cn = await ctx.db.get(args.id);
    if (!cn || cn.orgId !== args.orgId) throw new Error("Credit note not found");
    if (cn.status === "void") throw new Error("Already voided");
    if (cn.journalId) {
      const rev = await reverseJournalInternal(ctx, {
        orgId: args.orgId,
        journalId: cn.journalId,
        date: today(),
        postedByName: "Auto (credit note voided)",
      });
      if (rev === null) throw new Error("The posting period is locked — cannot void.");
    }
    const allocs = await ctx.db
      .query("allocations")
      .withIndex("by_credit_note", (q) => q.eq("creditNoteId", args.id))
      .collect();
    for (const a of allocs) {
      await ctx.db.delete(a._id);
      if (a.invoiceId) await recomputeInvoice(ctx, a.invoiceId);
      if (a.billId) await recomputeBill(ctx, a.billId);
    }
    await ctx.db.patch(args.id, { status: "void", updatedAt: tsNow() });
    return true;
  },
});

export const listCreditNotes = query({
  args: { secret: v.string(), orgId: v.id("organizations"), kind: v.optional(v.string()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db.query("creditNotes").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const filtered = all.filter((c) => !args.kind || c.kind === args.kind).sort((a, b) => b.createdAt - a.createdAt);
    const rows = [];
    for (const c of filtered) {
      const contact = await ctx.db.get(c.contactId);
      rows.push({
        id: c._id,
        kind: c.kind,
        number: c.number,
        contactId: c.contactId,
        contactName: contact?.name ?? "—",
        issueDate: c.issueDate,
        amount: c.amount,
        taxRate: c.taxRate ?? 0,
        subtotal: c.subtotal,
        taxTotal: c.taxTotal,
        total: c.total,
        reason: c.reason ?? null,
        status: c.status,
        journalId: c.journalId ?? null,
      });
    }
    return rows;
  },
});

/* ------------------------------------------------------------------ *
 * Aging
 * ------------------------------------------------------------------ */

function bucketise(ageDays: number): "current" | "d1_30" | "d31_60" | "d61_90" | "d90plus" {
  if (ageDays <= 0) return "current";
  if (ageDays <= 30) return "d1_30";
  if (ageDays <= 60) return "d31_60";
  if (ageDays <= 90) return "d61_90";
  return "d90plus";
}

export const aging = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    type: v.union(v.literal("ar"), v.literal("ap")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const empty = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    const byContact = new Map<
      string,
      { contactId: string; contactName: string; current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number }
    >();
    const items = args.type === "ar" ? await openInvoiceRows(ctx, args.orgId) : await openBillRows(ctx, args.orgId);
    for (const it of items) {
      const b = bucketise(it.ageDays);
      const cur = byContact.get(it.contactId) ?? {
        contactId: it.contactId,
        contactName: it.contactName,
        ...empty,
        total: 0,
      };
      cur[b] += it.balanceDue;
      cur.total += it.balanceDue;
      byContact.set(it.contactId, cur);
    }
    const rows = [...byContact.values()].sort((a, b) => b.total - a.total);
    const totals = rows.reduce(
      (acc, r) => {
        acc.current += r.current;
        acc.d1_30 += r.d1_30;
        acc.d31_60 += r.d31_60;
        acc.d61_90 += r.d61_90;
        acc.d90plus += r.d90plus;
        acc.total += r.total;
        return acc;
      },
      { ...empty, total: 0 }
    );
    return { type: args.type, asAt: today(), rows, totals };
  },
});

/* ------------------------------------------------------------------ *
 * Customer / supplier ledger (statement of account)
 * ------------------------------------------------------------------ */

export const contactLedger = query({
  args: { secret: v.string(), orgId: v.id("organizations"), contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.orgId !== args.orgId) throw new Error("Contact not found");

    const events: Array<{ date: string; ref: string; description: string; debit: number; credit: number }> = [];
    const isCustomer = contact.type === "customer";

    const invoices = await ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    for (const inv of invoices) {
      if (inv.contactId !== args.contactId) continue;
      if (["draft", "cancelled", "void"].includes(inv.status)) continue;
      events.push({ date: inv.issueDate, ref: inv.number, description: "Invoice issued", debit: inv.total, credit: 0 });
    }
    const bills = await ctx.db.query("bills").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    for (const bill of bills) {
      if (bill.contactId !== args.contactId) continue;
      if (["draft", "void"].includes(bill.status)) continue;
      events.push({ date: bill.billDate, ref: bill.number, description: "Bill recorded", debit: 0, credit: bill.amount });
    }
    const creditNotes = await ctx.db.query("creditNotes").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    for (const cn of creditNotes) {
      if (cn.contactId !== args.contactId || cn.status !== "issued") continue;
      if (cn.kind === "sales_credit") {
        events.push({ date: cn.issueDate, ref: cn.number, description: "Credit note", debit: 0, credit: cn.total });
      } else {
        events.push({ date: cn.issueDate, ref: cn.number, description: "Debit note", debit: cn.total, credit: 0 });
      }
    }
    const payments = await ctx.db.query("payments").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    for (const p of payments) {
      if (p.contactId !== args.contactId) continue;
      if (p.kind === "receipt") {
        events.push({ date: p.date, ref: p.reference || "Receipt", description: "Receipt", debit: 0, credit: p.amount });
      } else {
        events.push({ date: p.date, ref: p.reference || "Payment", description: "Payment", debit: p.amount, credit: 0 });
      }
    }

    events.sort((a, b) => (a.date === b.date ? a.ref.localeCompare(b.ref) : a.date.localeCompare(b.date)));
    let balance = 0;
    const rows = events.map((e) => {
      balance = roundKes(balance + e.debit - e.credit);
      return { ...e, balance };
    });
    return {
      contact: {
        id: contact._id,
        type: contact.type,
        number: contact.number ?? null,
        name: contact.name,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        tin: contact.tin ?? null,
        address: contact.address ?? null,
        paymentTerms: contact.paymentTerms ?? null,
      },
      rows,
      closingBalance: balance,
      label: isCustomer ? "Accounts receivable" : "Accounts payable",
    };
  },
});
