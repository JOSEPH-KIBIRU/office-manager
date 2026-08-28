import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { assertSecret, tsNow, fmtCreated } from "./lib";

type BillDoc = Doc<"bills">;

async function enrichBill(ctx: QueryCtx, b: BillDoc) {
  const contact = await ctx.db.get(b.contactId);
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
    description: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.orgId !== args.orgId) throw new Error("Supplier not found");
    if (contact.type !== "supplier") throw new Error("Bills must reference a supplier contact");
    if (!(args.amount > 0)) throw new Error("Amount must be greater than zero");
    const number = await nextBillNumber(ctx, args.orgId);
    return ctx.db.insert("bills", {
      orgId: args.orgId,
      contactId: args.contactId,
      number,
      billDate: args.billDate,
      dueDate: args.dueDate,
      amount: args.amount,
      description: args.description?.trim() || undefined,
      status: "pending",
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
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
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Bill not found");
    if (doc.status === "paid") throw new Error("Paid bills cannot be edited");

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
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("overdue")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Bill not found");
    if (args.status === "paid") {
      await ctx.db.patch(args.id, { status: "paid", paidAt: fmtCreated(Date.now()), updatedAt: tsNow() });
    } else {
      await ctx.db.patch(args.id, { status: args.status, paidAt: undefined, updatedAt: tsNow() });
    }
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
