import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { assertSecret, tsNow, tsString, fmtCreated } from "./lib";
import { notifyStaff, pushNotification } from "./notifications";

type LeaveDoc = Doc<"leaves">;

async function enrich(ctx: QueryCtx, l: LeaveDoc) {
  const requester = await ctx.db.get(l.userId);
  const approver = l.approvedBy ? await ctx.db.get(l.approvedBy) : null;
  return {
    id: l._id,
    user_id: l.userId,
    requester_name: requester?.name ?? "Unknown",
    approver_name: approver?.name ?? null,
    start_date: l.startDate,
    end_date: l.endDate,
    days: l.days,
    leave_type: l.leaveType,
    reason: l.reason,
    status: l.status,
    approved_at: l.approvedAt ?? null,
    admin_note: l.adminNote ?? null,
    created_at: fmtCreated(l.createdAt),
  };
}

export const listLeaves = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    let docs: LeaveDoc[];
    if (args.userId) {
      docs = await ctx.db
        .query("leaves")
        .withIndex("by_user", (q) => q.eq("userId", args.userId as never))
        .order("desc")
        .collect();
      docs = docs.filter((d) => d.orgId === args.orgId);
    } else {
      docs = await ctx.db
        .query("leaves")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", args.orgId).eq("status", "pending" as never)
        )
        .collect();
      const others = await ctx.db
        .query("leaves")
        .filter((q) => q.eq(q.field("orgId"), args.orgId))
        .collect();
      docs = [...others].sort((a, b) => b.createdAt - a.createdAt);
    }
    return Promise.all(docs.map((d) => enrich(ctx, d)));
  },
});

export const getLeave = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("leaves") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return enrich(ctx, doc);
  },
});

export const getLeaveBalance = query({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.userId);
    if (!user || user.orgId !== args.orgId) return 0;
    return user.leaveBalance;
  },
});

export const applyLeave = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    days: v.number(),
    leaveType: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.userId);
    if (!user || user.orgId !== args.orgId) throw new Error("User not found");
    if (user.leaveBalance < args.days) {
      throw new Error(
        `Insufficient leave balance. You have ${user.leaveBalance} day(s) left but requested ${args.days}.`
      );
    }
    await ctx.db.patch(user._id, { leaveBalance: user.leaveBalance - args.days });
    const id = await ctx.db.insert("leaves", {
      orgId: args.orgId,
      userId: user._id,
      startDate: args.startDate,
      endDate: args.endDate,
      days: args.days,
      leaveType: args.leaveType,
      reason: args.reason,
      status: "pending",
      createdAt: tsNow(),
    });
    await notifyStaff(ctx, args.orgId, {
      userId: "",
      type: "leave",
      title: "New leave request",
      body: `${user.name} requested ${args.days} day(s) of ${args.leaveType} leave (${args.startDate} → ${args.endDate}).`,
      link: "/leave",
    });
    return id;
  },
});

export const reviewLeave = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("leaves"),
    action: v.union(v.literal("approve"), v.literal("reject")),
    adminNote: v.optional(v.string()),
    reviewerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const leave = await ctx.db.get(args.id);
    if (!leave || leave.orgId !== args.orgId) throw new Error("Leave request not found");
    if (leave.status !== "pending") throw new Error(`This request has already been ${leave.status}`);

    if (args.action === "approve") {
      await ctx.db.patch(leave._id, {
        status: "approved",
        approvedBy: args.reviewerId,
        approvedAt: tsString(),
        adminNote: args.adminNote ?? leave.adminNote,
      });
      await pushNotification(ctx, args.orgId as unknown as string, {
        userId: leave.userId as unknown as string,
        type: "leave",
        title: "Leave approved",
        body: `Your ${leave.leaveType} leave (${leave.startDate} → ${leave.endDate}) was approved.`,
        link: "/leave",
      });
    } else {
      await ctx.db.patch(leave._id, {
        status: "rejected",
        approvedBy: args.reviewerId,
        approvedAt: tsString(),
        adminNote: args.adminNote ?? leave.adminNote,
      });
      const user = await ctx.db.get(leave.userId);
      if (user) {
        await ctx.db.patch(user._id, { leaveBalance: user.leaveBalance + leave.days });
      }
      await pushNotification(ctx, args.orgId as unknown as string, {
        userId: leave.userId as unknown as string,
        type: "leave",
        title: "Leave request declined",
        body: `Your ${leave.leaveType} leave (${leave.startDate} → ${leave.endDate}) was declined.`,
        link: "/leave",
      });
    }
    return true;
  },
});

export const editLeave = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("leaves"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    reason: v.optional(v.string()),
    leaveType: v.optional(v.string()),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const leave = await ctx.db.get(args.id);
    if (!leave || leave.orgId !== args.orgId) throw new Error("Leave request not found");

    const start = args.startDate ?? leave.startDate;
    const end = args.endDate ?? leave.endDate;
    if (end < start) throw new Error("End date cannot be before the start date");

    const s = new Date(start + "T00:00:00").getTime();
    const e = new Date(end + "T00:00:00").getTime();
    const newDays = Math.round((e - s) / 86400000) + 1;

    const delta = leave.days - newDays;
    const user = await ctx.db.get(leave.userId);
    if (!user) throw new Error("User not found");
    if (delta < 0 && user.leaveBalance + delta < 0) {
      throw new Error("Employee has insufficient leave balance for the new duration");
    }

    await ctx.db.patch(leave._id, {
      startDate: start,
      endDate: end,
      days: newDays,
      leaveType: args.leaveType ?? leave.leaveType,
      reason: args.reason !== undefined ? args.reason.trim() : leave.reason,
      adminNote: args.adminNote ?? leave.adminNote,
    });
    if (delta !== 0 && leave.status !== "rejected") {
      await ctx.db.patch(user._id, { leaveBalance: user.leaveBalance + delta });
    }
    return true;
  },
});

export const deleteLeave = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("leaves") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const leave = await ctx.db.get(args.id);
    if (!leave || leave.orgId !== args.orgId) throw new Error("Leave request not found");
    await ctx.db.delete(leave._id);
    if (leave.status === "pending" || leave.status === "approved") {
      const user = await ctx.db.get(leave.userId);
      if (user) {
        await ctx.db.patch(user._id, { leaveBalance: user.leaveBalance + leave.days });
      }
    }
    return true;
  },
});
