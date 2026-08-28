import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { assertSecret, tsNow, tsString, fmtCreated } from "./lib";

type ContactDoc = Doc<"contacts">;
type InvoiceDoc = Doc<"invoices">;

function computeTotals(items: Array<{ description: string; qty: number; unitPrice: number; taxRate: number }>) {
  let subtotal = 0;
  let taxTotal = 0;
  for (const it of items) {
    const line = it.qty * it.unitPrice;
    const tax = line * (it.taxRate / 100);
    subtotal += line;
    taxTotal += tax;
  }
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    total: Math.round((subtotal + taxTotal) * 100) / 100,
    lineItems: items.map((it) => ({
      description: it.description,
      qty: it.qty,
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
    })),
  };
}

async function enrichInvoice(ctx: QueryCtx, inv: InvoiceDoc) {
  const contact = await ctx.db.get(inv.contactId);
  return {
    id: inv._id,
    contact_id: inv.contactId,
    contact_name: contact?.name ?? "—",
    contact_company: contact?.company ?? null,
    contact_email: contact?.email ?? null,
    contact_phone: contact?.phone ?? null,
    contact_address: contact?.address ?? null,
    contact_tin: contact?.tin ?? null,
    number: inv.number,
    issue_date: inv.issueDate,
    due_date: inv.dueDate,
    status: inv.status,
    line_items: inv.lineItems,
    note: inv.note ?? null,
    subtotal: inv.subtotal,
    tax_total: inv.taxTotal,
    total: inv.total,
    recurring_frequency: inv.recurringFrequency ?? null,
    recurring_active: inv.recurringActive ?? false,
    created_by: inv.createdBy,
    created_at: fmtCreated(inv.createdAt),
    updated_at: fmtCreated(inv.updatedAt),
  };
}

async function enrichContact(ctx: QueryCtx, c: ContactDoc) {
  return {
    id: c._id,
    type: c.type,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    company: c.company ?? null,
    address: c.address ?? null,
    tin: c.tin ?? null,
    created_at: fmtCreated(c.createdAt),
  };
}

async function nextInvoiceNumber(ctx: MutationCtx | QueryCtx, orgId: Id<"organizations">): Promise<string> {
  const all = await ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  return `INV-${String(all.length + 1).padStart(4, "0")}`;
}

/* ---------------- Contacts ---------------- */

export const listContacts = query({
  args: { secret: v.string(), orgId: v.id("organizations"), type: v.optional(v.union(v.literal("customer"), v.literal("supplier"))) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db.query("contacts").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const docs = args.type ? all.filter((c) => c.type === args.type) : all;
    return Promise.all([...docs].sort((a, b) => b.createdAt - a.createdAt).map((d) => enrichContact(ctx, d)));
  },
});

export const getContact = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("contacts") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return enrichContact(ctx, doc);
  },
});

export const createContact = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    type: v.union(v.literal("customer"), v.literal("supplier")),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    address: v.optional(v.string()),
    tin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (!args.name.trim()) throw new Error("Contact name is required");
    return ctx.db.insert("contacts", {
      orgId: args.orgId,
      type: args.type,
      name: args.name.trim(),
      email: args.email?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      company: args.company?.trim() || undefined,
      address: args.address?.trim() || undefined,
      tin: args.tin?.trim() || undefined,
      createdAt: tsNow(),
    });
  },
});

export const updateContact = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("contacts"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    address: v.optional(v.string()),
    tin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Contact not found");
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.email !== undefined) patch.email = args.email?.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone?.trim() || undefined;
    if (args.company !== undefined) patch.company = args.company?.trim() || undefined;
    if (args.address !== undefined) patch.address = args.address?.trim() || undefined;
    if (args.tin !== undefined) patch.tin = args.tin?.trim() || undefined;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const deleteContact = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("contacts") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Contact not found");
    await ctx.db.delete(args.id);
    return true;
  },
});

/* ---------------- Invoices ---------------- */

export const listInvoices = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(sorted.map((d) => enrichInvoice(ctx, d)));
  },
});

export const getInvoice = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("invoices") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return enrichInvoice(ctx, doc);
  },
});

export const createInvoice = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    issueDate: v.string(),
    dueDate: v.string(),
    lineItems: v.array(
      v.object({ description: v.string(), qty: v.number(), unitPrice: v.number(), taxRate: v.number() })
    ),
    note: v.optional(v.string()),
    recurringFrequency: v.optional(
      v.union(v.literal("weekly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly"))
    ),
    recurringActive: v.optional(v.boolean()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.orgId !== args.orgId) throw new Error("Contact not found");
    if (!args.lineItems.length) throw new Error("Add at least one line item");
    const c = computeTotals(args.lineItems);
    const number = await nextInvoiceNumber(ctx, args.orgId);
    return ctx.db.insert("invoices", {
      orgId: args.orgId,
      contactId: args.contactId,
      number,
      issueDate: args.issueDate,
      dueDate: args.dueDate,
      status: "draft",
      lineItems: c.lineItems,
      note: args.note?.trim() || undefined,
      subtotal: c.subtotal,
      taxTotal: c.taxTotal,
      total: c.total,
      recurringFrequency: args.recurringFrequency,
      recurringActive: args.recurringActive ?? false,
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
  },
});

export const updateInvoice = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("invoices"),
    contactId: v.optional(v.id("contacts")),
    issueDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    lineItems: v.optional(
      v.array(v.object({ description: v.string(), qty: v.number(), unitPrice: v.number(), taxRate: v.number() }))
    ),
    note: v.optional(v.string()),
    recurringFrequency: v.optional(
      v.union(v.literal("weekly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly"))
    ),
    recurringActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Invoice not found");

    const patch: Record<string, unknown> = {};
    if (args.contactId !== undefined) {
      const contact = await ctx.db.get(args.contactId);
      if (!contact || contact.orgId !== args.orgId) throw new Error("Contact not found");
      patch.contactId = args.contactId;
    }
    if (args.issueDate !== undefined) patch.issueDate = args.issueDate;
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    if (args.lineItems !== undefined) {
      if (!args.lineItems.length) throw new Error("Add at least one line item");
      const c = computeTotals(args.lineItems);
      patch.lineItems = c.lineItems;
      patch.subtotal = c.subtotal;
      patch.taxTotal = c.taxTotal;
      patch.total = c.total;
    }
    if (args.note !== undefined) patch.note = args.note?.trim() || undefined;
    if (args.recurringFrequency !== undefined) patch.recurringFrequency = args.recurringFrequency;
    if (args.recurringActive !== undefined) patch.recurringActive = args.recurringActive;
    patch.updatedAt = tsNow();
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const setInvoiceStatus = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("invoices"),
    status: v.union(v.literal("draft"), v.literal("sent"), v.literal("paid"), v.literal("overdue"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Invoice not found");
    if (doc.status === "cancelled" && args.status !== "cancelled") {
      throw new Error("Cancelled invoices cannot be reactivated");
    }
    await ctx.db.patch(args.id, { status: args.status, updatedAt: tsNow() });
    return true;
  },
});

export const deleteInvoice = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("invoices") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Invoice not found");
    await ctx.db.delete(args.id);
    return true;
  },
});
