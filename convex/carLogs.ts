import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { assertSecret, tsNow, tsString, fmtCreated } from "./lib";
import { tryPostJournalForSource } from "./accounting";
import { notifyStaff, pushNotification } from "./notifications";

type CarLogDoc = Doc<"carLogs">;

async function enrich(ctx: QueryCtx, c: CarLogDoc) {
  const requester = await ctx.db.get(c.requestedBy);
  const approver = c.approvedBy ? await ctx.db.get(c.approvedBy) : null;
  return {
    id: c._id,
    requested_by: c.requestedBy,
    requisition_no: c.requisitionNo ?? null,
    vehicle_reg: c.vehicleReg,
    category: c.category,
    description: c.description,
    vendor: c.vendor ?? null,
    amount: c.amount,
    log_date: c.logDate,
    status: c.status,
    requested_by_name: requester?.name ?? null,
    approved_by_name: approver?.name ?? null,
    approved_at: c.approvedAt ?? null,
    note: c.note ?? null,
    created_at: fmtCreated(c.createdAt),
  };
}

export const listCarLogs = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const docs = await ctx.db
      .query("carLogs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const sorted = [...docs].sort((a, b) => b.logDate.localeCompare(a.logDate));
    return Promise.all(sorted.map((d) => enrich(ctx, d)));
  },
});

export const getCarLog = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("carLogs") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return enrich(ctx, doc);
  },
});

export const createCarLog = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    requestedBy: v.id("users"),
    vehicleReg: v.string(),
    category: v.union(v.literal("repair"), v.literal("insurance"), v.literal("service")),
    description: v.string(),
    vendor: v.optional(v.string()),
    amount: v.number(),
    logDate: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const existing = await ctx.db
      .query("carLogs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const reqNo = `RQ-CAR-${String(existing.length + 1).padStart(4, "0")}`;
    const requester = await ctx.db.get(args.requestedBy);
    const id = await ctx.db.insert("carLogs", {
      orgId: args.orgId,
      vehicleReg: args.vehicleReg,
      category: args.category,
      description: args.description,
      vendor: args.vendor,
      amount: args.amount,
      logDate: args.logDate,
      status: "pending",
      requestedBy: args.requestedBy,
      createdAt: tsNow(),
      requisitionNo: reqNo,
    });
    await notifyStaff(ctx, args.orgId, {
      userId: args.requestedBy as unknown as string,
      type: "car",
      title: "New car log request",
      body: `${requester?.name ?? "Someone"} submitted a ${args.category} expense of ${args.amount} for ${args.vehicleReg}.`,
      link: "/cars",
    });
    return id;
  },
});

export const updateCarLog = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("carLogs"),
    action: v.optional(v.union(v.literal("approve"), v.literal("reject"))),
    reviewerId: v.optional(v.id("users")),
    note: v.optional(v.string()),
    vehicleReg: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    vendor: v.optional(v.string()),
    amount: v.optional(v.number()),
    logDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== args.orgId) throw new Error("Car log not found");

    if (args.action) {
      if (row.status !== "pending") throw new Error(`Already ${row.status}`);
      const status = args.action === "approve" ? "approved" : "rejected";
      await ctx.db.patch(row._id, {
        status,
        approvedBy: args.reviewerId,
        approvedAt: tsString(),
        note: args.note ?? row.note,
      });
      if (status === "approved") {
        const expenseCode = row.category === "insurance" ? "5120" : "5110";
        await tryPostJournalForSource(ctx, {
          orgId: args.orgId,
          source: "car_log",
          sourceId: row._id,
          date: row.logDate,
          description: `Car ${row.category} · ${row.vehicleReg}`,
          lines: [
            { accountCode: expenseCode, debit: row.amount, credit: 0, memo: row.vehicleReg },
            { accountCode: "1020", debit: 0, credit: row.amount, memo: row.vehicleReg },
          ],
          postedByName: "Auto (car log approved)",
        });
      }
      await pushNotification(ctx, args.orgId as unknown as string, {
        userId: row.requestedBy as unknown as string,
        type: "car",
        title: `Car log ${status}`,
        body: `Your ${row.category} request (${row.vehicleReg}) for KSh ${row.amount} was ${status}.`,
        link: "/cars",
      });
    } else {
      if (row.status !== "pending") throw new Error("Approved entries can no longer be edited");
      const patch: Record<string, unknown> = {};
      if (args.vehicleReg !== undefined) patch.vehicleReg = args.vehicleReg;
      if (args.category !== undefined) patch.category = args.category;
      if (args.description !== undefined) patch.description = args.description;
      if (args.vendor !== undefined) patch.vendor = args.vendor;
      if (args.amount !== undefined) patch.amount = args.amount;
      if (args.logDate !== undefined) patch.logDate = args.logDate;
      await ctx.db.patch(row._id, patch);
    }
    return true;
  },
});

export const deleteCarLog = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("carLogs") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== args.orgId) throw new Error("Car log not found");
    if (row.status === "approved") throw new Error("Approved entries cannot be deleted");
    await ctx.db.delete(args.id);
    return true;
  },
});
