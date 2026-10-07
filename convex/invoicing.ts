import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { assertSecret, tsNow, tsString, fmtCreated, orgBranding } from "./lib";
import { tryPostJournalForSource, reverseJournalInternal, nextSeq } from "./accounting";

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
  const org = await orgBranding(ctx, inv.orgId);
  return {
    id: inv._id,
    org,
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
    note: inv.note ?? org?.invoiceNotes ?? null,
    payment_details: inv.paymentDetails ?? org?.paymentDetails ?? null,
    terms: inv.terms ?? org?.invoiceTerms ?? null,
    subtotal: inv.subtotal,
    tax_total: inv.taxTotal,
    total: inv.total,
    amount_paid: inv.amountPaid ?? 0,
    balance_due: Math.round((inv.total - (inv.amountPaid ?? 0)) * 100) / 100,
    cost_center_code: inv.costCenterCode ?? null,
    project_id: inv.projectId ?? null,
    recurring_frequency: inv.recurringFrequency ?? null,
    recurring_active: inv.recurringActive ?? false,
    etims_status: inv.etimsStatus ?? "not_sent",
    etims_control_number: inv.etimsControlNumber ?? null,
    etims_qr_data: inv.etimsQrData ?? null,
    etims_submitted_at: inv.etimsSubmittedAt ?? null,
    etims_error: inv.etimsError ?? null,
    created_by: inv.createdBy,
    created_at: fmtCreated(inv.createdAt),
    updated_at: fmtCreated(inv.updatedAt),
  };
}

async function enrichContact(ctx: QueryCtx, c: ContactDoc) {
  return {
    id: c._id,
    type: c.type,
    number: c.number ?? null,
    name: c.name,
    legalName: c.legalName ?? null,
    contactPerson: c.contactPerson ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    company: c.company ?? null,
    address: c.address ?? null,
    tin: c.tin ?? null,
    paymentTerms: c.paymentTerms ?? null,
    creditLimit: c.creditLimit ?? null,
    notes: c.notes ?? null,
    active: c.active ?? true,
    created_at: fmtCreated(c.createdAt),
    updated_at: c.updatedAt ? fmtCreated(c.updatedAt) : null,
  };
}

async function nextInvoiceNumber(ctx: MutationCtx | QueryCtx, orgId: Id<"organizations">): Promise<string> {
  const n = await nextSeq(ctx as MutationCtx, orgId, "INV");
  return `INV-${String(n).padStart(4, "0")}`;
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
    legalName: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    address: v.optional(v.string()),
    tin: v.optional(v.string()),
    paymentTerms: v.optional(v.number()),
    creditLimit: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (!args.name.trim()) throw new Error("Contact name is required");
    const prefix = args.type === "customer" ? "CUS" : "SUP";
    const n = await nextSeq(ctx, args.orgId, prefix);
    const number = `${prefix}-${String(n).padStart(4, "0")}`;
    return ctx.db.insert("contacts", {
      orgId: args.orgId,
      type: args.type,
      number,
      name: args.name.trim(),
      legalName: args.legalName?.trim() || undefined,
      contactPerson: args.contactPerson?.trim() || undefined,
      email: args.email?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      company: args.company?.trim() || undefined,
      address: args.address?.trim() || undefined,
      tin: args.tin?.trim() || undefined,
      paymentTerms: args.paymentTerms,
      creditLimit: args.creditLimit,
      notes: args.notes?.trim() || undefined,
      active: true,
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
  },
});

export const updateContact = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("contacts"),
    name: v.optional(v.string()),
    legalName: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    address: v.optional(v.string()),
    tin: v.optional(v.string()),
    paymentTerms: v.optional(v.number()),
    creditLimit: v.optional(v.number()),
    notes: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Contact not found");
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.legalName !== undefined) patch.legalName = args.legalName?.trim() || undefined;
    if (args.contactPerson !== undefined) patch.contactPerson = args.contactPerson?.trim() || undefined;
    if (args.email !== undefined) patch.email = args.email?.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone?.trim() || undefined;
    if (args.company !== undefined) patch.company = args.company?.trim() || undefined;
    if (args.address !== undefined) patch.address = args.address?.trim() || undefined;
    if (args.tin !== undefined) patch.tin = args.tin?.trim() || undefined;
    if (args.paymentTerms !== undefined) patch.paymentTerms = args.paymentTerms;
    if (args.creditLimit !== undefined) patch.creditLimit = args.creditLimit;
    if (args.notes !== undefined) patch.notes = args.notes?.trim() || undefined;
    if (args.active !== undefined) patch.active = args.active;
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
    const inv = await ctx.db.query("invoices").withIndex("by_org_contact", (q) => q.eq("orgId", args.orgId).eq("contactId", args.id)).first();
    const bill = await ctx.db.query("bills").withIndex("by_org_contact", (q) => q.eq("orgId", args.orgId).eq("contactId", args.id)).first();
    const pay = await ctx.db.query("payments").withIndex("by_org_contact", (q) => q.eq("orgId", args.orgId).eq("contactId", args.id)).first();
    const cn = await ctx.db.query("creditNotes").withIndex("by_org_contact", (q) => q.eq("orgId", args.orgId).eq("contactId", args.id)).first();
    const projects = await ctx.db.query("projects").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const prj = projects.some((p) => p.customerId === args.id);
    if (inv || bill || pay || cn || prj) {
      throw new Error("This contact has transactions (invoices, bills, receipts, notes or projects). Deactivate it instead of deleting.");
    }
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
    paymentDetails: v.optional(v.string()),
    terms: v.optional(v.string()),
    recurringFrequency: v.optional(
      v.union(v.literal("weekly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly"))
    ),
    recurringActive: v.optional(v.boolean()),
    costCenterCode: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
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
      paymentDetails: args.paymentDetails?.trim() || undefined,
      terms: args.terms?.trim() || undefined,
      subtotal: c.subtotal,
      taxTotal: c.taxTotal,
      total: c.total,
      amountPaid: 0,
      costCenterCode: args.costCenterCode || undefined,
      projectId: args.projectId,
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
    paymentDetails: v.optional(v.string()),
    terms: v.optional(v.string()),
    recurringFrequency: v.optional(
      v.union(v.literal("weekly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly"))
    ),
    recurringActive: v.optional(v.boolean()),
    costCenterCode: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
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
    if (args.paymentDetails !== undefined) patch.paymentDetails = args.paymentDetails?.trim() || undefined;
    if (args.terms !== undefined) patch.terms = args.terms?.trim() || undefined;
    if (args.recurringFrequency !== undefined) patch.recurringFrequency = args.recurringFrequency;
    if (args.recurringActive !== undefined) patch.recurringActive = args.recurringActive;
    if (args.costCenterCode !== undefined) patch.costCenterCode = args.costCenterCode || undefined;
    if (args.projectId !== undefined) patch.projectId = args.projectId ?? undefined;
    patch.updatedAt = tsNow();
    await ctx.db.patch(args.id, patch);
    // Re-post the ledger journal so the GL always matches the edited invoice.
    await repostInvoiceJournal(ctx, args.id);
    return true;
  },
});

/**
 * Reverse any active journal for an invoice and re-post it from the current
 * document values. Used when a posted invoice is edited, and on deletion
 * (reverse + delete).
 */
async function repostInvoiceJournal(ctx: MutationCtx, invoiceId: Id<"invoices">): Promise<void> {
  const inv = await ctx.db.get(invoiceId);
  if (!inv) return;
  const existing = await ctx.db
    .query("journals")
    .withIndex("by_source", (q) => q.eq("orgId", inv.orgId).eq("source", "invoice").eq("sourceId", invoiceId as never))
    .collect();
  for (const j of existing) {
    if (!j.reversedBy) {
      await reverseJournalInternal(ctx, {
        orgId: inv.orgId,
        journalId: j._id,
        date: new Date().toISOString().slice(0, 10),
        postedByName: "Auto (invoice updated)",
      });
    }
  }
  if (["sent", "paid", "overdue", "partially_paid"].includes(inv.status)) {
    await tryPostJournalForSource(ctx, {
      orgId: inv.orgId,
      source: "invoice",
      sourceId: invoiceId,
      date: inv.issueDate,
      description: `Invoice ${inv.number} issued`,
      lines: [
        { accountCode: "1100", debit: inv.total, credit: 0, memo: inv.number, costCenterCode: inv.costCenterCode, projectId: inv.projectId as never },
        { accountCode: "4000", debit: 0, credit: inv.subtotal, memo: inv.number, costCenterCode: inv.costCenterCode, projectId: inv.projectId as never },
        { accountCode: "2150", debit: 0, credit: inv.taxTotal, memo: "VAT output", costCenterCode: inv.costCenterCode, projectId: inv.projectId as never },
      ],
      postedByName: "Auto (invoice updated)",
    });
  }
}

export const setInvoiceStatus = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("invoices"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("partially_paid"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled"),
      v.literal("void")
    ),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Invoice not found");
    // Payments are the source of truth for settlement — never mark paid directly.
    if (args.status === "paid" || args.status === "partially_paid") {
      throw new Error(
        "Record a customer receipt to settle this invoice. Invoices cannot be marked paid directly."
      );
    }
    if (doc.status === "void") throw new Error("Voided invoices cannot be changed.");
    if (doc.status === "cancelled" && args.status !== "cancelled") {
      throw new Error("Cancelled invoices cannot be reactivated");
    }
    await ctx.db.patch(args.id, { status: args.status, updatedAt: tsNow() });

    // Auto-post to the general ledger: revenue once issued, reverse on cancel/void.
    if (args.status === "sent" || args.status === "overdue") {
      await tryPostJournalForSource(ctx, {
        orgId: args.orgId,
        source: "invoice",
        sourceId: doc._id,
        date: doc.issueDate,
        description: `Invoice ${doc.number} issued`,
        lines: [
          { accountCode: "1100", debit: doc.total, credit: 0, memo: doc.number, costCenterCode: doc.costCenterCode, projectId: doc.projectId as never },
          { accountCode: "4000", debit: 0, credit: doc.subtotal, memo: doc.number, costCenterCode: doc.costCenterCode, projectId: doc.projectId as never },
          { accountCode: "2150", debit: 0, credit: doc.taxTotal, memo: "VAT output", costCenterCode: doc.costCenterCode, projectId: doc.projectId as never },
        ],
        postedByName: "Auto (invoice issued)",
      });
    } else if ((args.status === "cancelled" || args.status === "void") && doc.status !== "cancelled") {
      const existing = await ctx.db
        .query("journals")
        .withIndex("by_source", (q) => q.eq("orgId", args.orgId).eq("source", "invoice").eq("sourceId", doc._id as never))
        .first();
      if (existing && !existing.reversedBy) {
        await reverseJournalInternal(ctx, {
          orgId: args.orgId,
          journalId: existing._id,
          date: new Date().toISOString().slice(0, 10),
          postedByName: "Auto (invoice cancelled)",
        });
      }
    }
    return true;
  },
});

export const deleteInvoice = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("invoices") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Invoice not found");
    if ((doc.amountPaid ?? 0) > 0) {
      throw new Error("This invoice has receipts applied — void the receipt(s) before deleting.");
    }
    // Reverse the ledger journal(s), then remove any allocations, then the invoice.
    const existing = await ctx.db
      .query("journals")
      .withIndex("by_source", (q) => q.eq("orgId", args.orgId).eq("source", "invoice").eq("sourceId", args.id as never))
      .collect();
    for (const j of existing) {
      if (!j.reversedBy) {
        await reverseJournalInternal(ctx, {
          orgId: args.orgId,
          journalId: j._id,
          date: new Date().toISOString().slice(0, 10),
          postedByName: "Auto (invoice deleted)",
        });
      }
    }
    const allocs = await ctx.db.query("allocations").withIndex("by_invoice", (q) => q.eq("invoiceId", args.id)).collect();
    for (const a of allocs) await ctx.db.delete(a._id);
    await ctx.db.delete(args.id);
    return true;
  },
});

/** Record the outcome of an eTIMS (KRA) submission attempt. */
export const setEtimsResult = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("invoices"),
    status: v.union(v.literal("pending"), v.literal("submitted"), v.literal("failed")),
    controlNumber: v.optional(v.string()),
    qrData: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Invoice not found");
    await ctx.db.patch(args.id, {
      etimsStatus: args.status,
      etimsControlNumber: args.status === "submitted" ? args.controlNumber : undefined,
      etimsQrData: args.status === "submitted" ? args.qrData : undefined,
      etimsSubmittedAt: args.status === "submitted" ? tsNow() : undefined,
      etimsError: args.status === "failed" ? args.error?.slice(0, 500) : undefined,
      updatedAt: tsNow(),
    });
    return true;
  },
});
