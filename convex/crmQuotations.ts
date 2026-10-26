import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, requireMember, tsNow } from "./lib";
import { requireOptionalRef, requireTenantRef } from "./crmLib";
import { nextSeq } from "./accounting";

const ITEM = v.object({
  description: v.string(),
  qty: v.number(),
  unitPrice: v.number(),
  taxRate: v.number(),
});

const STATUS = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("expired"),
  v.literal("converted")
);

function clean(s?: string | null): string | undefined {
  const t = (s ?? "").trim();
  return t.length ? t : undefined;
}
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function date(s: string | undefined, label: string): string | undefined {
  const t = (s ?? "").trim();
  if (!t) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error(`${label} must be YYYY-MM-DD`);
  return t;
}
function computeTotals(items: Array<{ qty: number; unitPrice: number; taxRate: number }>) {
  let subtotal = 0;
  let taxTotal = 0;
  for (const it of items) {
    const line = it.qty * it.unitPrice;
    subtotal += line;
    taxTotal += line * (it.taxRate / 100);
  }
  return { subtotal: round(subtotal), taxTotal: round(taxTotal), total: round(subtotal + taxTotal) };
}
function validateItems(items: Array<{ description: string; qty: number; unitPrice: number; taxRate: number }>) {
  if (!items.length) throw new Error("Add at least one line item");
  for (const it of items) {
    if (!it.description.trim()) throw new Error("Each item needs a description");
    if (!Number.isFinite(it.qty) || it.qty <= 0) throw new Error("Item quantity must be greater than zero");
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) throw new Error("Item price cannot be negative");
    if (!Number.isFinite(it.taxRate) || it.taxRate < 0) throw new Error("Item tax rate cannot be negative");
  }
}

export const listQuotations = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    status: v.optional(STATUS),
    companyId: v.optional(v.id("crmCompanies")),
    dealId: v.optional(v.id("crmDeals")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const rows = await ctx.db
      .query("crmQuotations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .filter((q) => (args.status ? q.status === args.status : true))
      .filter((q) => (args.companyId ? q.companyId === args.companyId : true))
      .filter((q) => (args.dealId ? q.dealId === args.dealId : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getQuotation = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("crmQuotations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    const items = await ctx.db
      .query("crmQuotationItems")
      .withIndex("by_quotation", (q) => q.eq("quotationId", args.id))
      .collect();
    return { ...doc, items: items.sort((a, b) => a.order - b.order) };
  },
});

export const createQuotation = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    companyId: v.optional(v.id("crmCompanies")),
    contactId: v.optional(v.id("crmContacts")),
    dealId: v.optional(v.id("crmDeals")),
    issueDate: v.string(),
    validUntil: v.optional(v.string()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    terms: v.optional(v.string()),
    items: v.array(ITEM),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const issueDate = date(args.issueDate, "Issue date");
    if (!issueDate) throw new Error("Issue date is required");
    const validUntil = date(args.validUntil, "Valid-until date");
    validateItems(args.items);

    if (args.companyId) await requireOptionalRef(ctx, args.orgId, args.companyId, "Company");
    if (args.contactId) await requireOptionalRef(ctx, args.orgId, args.contactId, "Contact");
    if (args.dealId) await requireOptionalRef(ctx, args.orgId, args.dealId, "Deal");

    const totals = computeTotals(args.items);
    const seq = await nextSeq(ctx, args.orgId, "QUO");
    const number = `QUO-${String(seq).padStart(4, "0")}`;
    const now = tsNow();

    const id = await ctx.db.insert("crmQuotations", {
      orgId: args.orgId,
      number,
      companyId: args.companyId,
      contactId: args.contactId,
      dealId: args.dealId,
      status: "draft",
      issueDate,
      validUntil,
      currency: clean(args.currency) ?? "KES",
      notes: clean(args.notes),
      terms: clean(args.terms),
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });

    await addItems(ctx, args.orgId, id, args.items);
    return { id, number };
  },
});

async function addItems(
  ctx: any,
  orgId: any,
  quotationId: any,
  items: Array<{ description: string; qty: number; unitPrice: number; taxRate: number }>
) {
  const now = tsNow();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await ctx.db.insert("crmQuotationItems", {
      orgId,
      quotationId,
      description: it.description.trim(),
      qty: it.qty,
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      order: i,
      createdAt: now,
    });
  }
}

export const updateQuotation = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmQuotations"),
    companyId: v.optional(v.union(v.id("crmCompanies"), v.null())),
    contactId: v.optional(v.union(v.id("crmContacts"), v.null())),
    dealId: v.optional(v.union(v.id("crmDeals"), v.null())),
    issueDate: v.optional(v.string()),
    validUntil: v.optional(v.union(v.string(), v.null())),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    terms: v.optional(v.string()),
    items: v.optional(v.array(ITEM)),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Quotation not found");
    if (doc.status === "converted") throw new Error("Converted quotations cannot be edited");

    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.issueDate !== undefined) {
      const d = date(args.issueDate, "Issue date");
      if (!d) throw new Error("Issue date is required");
      patch.issueDate = d;
    }
    if (args.validUntil !== undefined) {
      patch.validUntil = args.validUntil === null ? undefined : date(args.validUntil, "Valid-until date");
    }
    if (args.currency !== undefined) patch.currency = clean(args.currency) ?? "KES";
    if (args.notes !== undefined) patch.notes = clean(args.notes);
    if (args.terms !== undefined) patch.terms = clean(args.terms);

    if (args.companyId !== undefined) {
      if (args.companyId !== null) await requireOptionalRef(ctx, args.orgId, args.companyId, "Company");
      patch.companyId = args.companyId ?? undefined;
    }
    if (args.contactId !== undefined) {
      if (args.contactId !== null) await requireOptionalRef(ctx, args.orgId, args.contactId, "Contact");
      patch.contactId = args.contactId ?? undefined;
    }
    if (args.dealId !== undefined) {
      if (args.dealId !== null) await requireOptionalRef(ctx, args.orgId, args.dealId, "Deal");
      patch.dealId = args.dealId ?? undefined;
    }

    if (args.items !== undefined) {
      validateItems(args.items);
      const existing = await ctx.db
        .query("crmQuotationItems")
        .withIndex("by_quotation", (q) => q.eq("quotationId", args.id))
        .collect();
      for (const it of existing) await ctx.db.delete(it._id);
      await addItems(ctx, args.orgId, args.id, args.items);
      const totals = computeTotals(args.items);
      patch.subtotal = totals.subtotal;
      patch.taxTotal = totals.taxTotal;
      patch.total = totals.total;
    }

    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const setQuotationStatus = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmQuotations"),
    status: STATUS,
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Quotation not found");
    if (doc.status === "converted") throw new Error("Converted quotations cannot be changed");
    if (args.status === "converted") throw new Error("Use the convert action to create an invoice");

    const patch: Record<string, unknown> = { status: args.status, updatedAt: tsNow() };
    if (args.status === "sent") patch.sentAt = tsNow();
    if (args.status === "accepted") patch.acceptedAt = tsNow();
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const markConverted = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmQuotations"),
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Quotation not found");
    if (doc.invoiceId) return { invoiceId: doc.invoiceId, already: true };
    await ctx.db.patch(args.id, {
      invoiceId: args.invoiceId,
      status: "converted",
      updatedAt: tsNow(),
    });
    return { invoiceId: args.invoiceId, already: false };
  },
});

export const deleteQuotation = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmQuotations"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Quotation not found");
    if (doc.invoiceId) throw new Error("This quotation has been converted to an invoice");
    const items = await ctx.db
      .query("crmQuotationItems")
      .withIndex("by_quotation", (q) => q.eq("quotationId", args.id))
      .collect();
    for (const it of items) await ctx.db.delete(it._id);
    await ctx.db.delete(args.id);
    return true;
  },
});
