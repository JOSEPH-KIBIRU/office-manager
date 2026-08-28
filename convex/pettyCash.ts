import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { assertSecret, tsNow, tsString, fmtCreated } from "./lib";
import { notifyStaff, pushNotification } from "./notifications";

type PettyDoc = Doc<"pettyCash">;

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
