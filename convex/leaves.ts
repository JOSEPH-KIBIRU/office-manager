import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { assertSecret, tsNow, tsString, fmtCreated, requireMember } from "./lib";
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

/**
 * Authoritative working-day count for a date range: only the org's working
 * weekdays, excluding public holidays. Lives in Convex so day counts cannot be
 * spoofed by a caller — the client's number is never trusted.
 */
async function computeWorkingDays(
  ctx: { db: QueryCtx["db"] },
  orgId: Id<"organizations">,
  start: string,
  end: string
): Promise<number> {
  const org = await ctx.db.get(orgId);
  const working = new Set<number>(
    org?.workingDays && org.workingDays.length ? org.workingDays : [1, 2, 3, 4, 5]
  );
  const holidays = await ctx.db
    .query("holidays")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const holidaySet = new Set(holidays.map((h) => h.date));

  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  let count = 0;
  for (const dt = new Date(s); dt <= e; dt.setUTCDate(dt.getUTCDate() + 1)) {
    if (working.has(dt.getUTCDay()) && !holidaySet.has(dt.toISOString().slice(0, 10))) count += 1;
  }
  return count;
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
      await requireMember(ctx, args.orgId, args.userId);
      docs = await ctx.db
        .query("leaves")
        .withIndex("by_user", (q) => q.eq("userId", args.userId as never))
        .order("desc")
        .collect();
      docs = docs.filter((d) => d.orgId === args.orgId);
    } else {
      docs = await ctx.db
        .query("leaves")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      docs = [...docs].sort((a, b) => b.createdAt - a.createdAt);
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
    const days = await computeWorkingDays(ctx, args.orgId, args.startDate, args.endDate);
    if (days <= 0) throw new Error("The selected dates contain no working days.");
    if (user.leaveBalance < days) {
      throw new Error(
        `Insufficient leave balance. You have ${user.leaveBalance} day(s) left but requested ${days}.`
      );
    }
    // Prevent overlapping leave requests for the same person.
    const existing = await ctx.db
      .query("leaves")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const overlap = existing.find(
      (l) =>
        (l.status === "pending" || l.status === "approved") &&
        l.startDate <= args.endDate &&
        args.startDate <= l.endDate
    );
    if (overlap) throw new Error("There is already a leave request covering those dates.");
    await ctx.db.patch(user._id, { leaveBalance: user.leaveBalance - days });
    const id = await ctx.db.insert("leaves", {
      orgId: args.orgId,
      userId: user._id,
      startDate: args.startDate,
      endDate: args.endDate,
      days,
      leaveType: args.leaveType,
      reason: args.reason,
      status: "pending",
      createdAt: tsNow(),
    });
    await notifyStaff(ctx, args.orgId, {
      userId: "",
      type: "leave",
      title: "New leave request",
      body: `${user.name} requested ${days} day(s) of ${args.leaveType} leave (${args.startDate} → ${args.endDate}).`,
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
    days: v.optional(v.number()),
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

    // Working days are always recomputed server-side (weekends/holidays excluded).
    const newDays = await computeWorkingDays(ctx, args.orgId, start, end);

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

/** Unpaid leave-encashment days for a year (used to pay them via payroll). */
export const listEncashments = query({
  args: { secret: v.string(), orgId: v.id("organizations"), year: v.number() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db
      .query("leaveCarryOvers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const names = new Map(users.map((u) => [u._id as string, u.name]));
    return rows
      .filter((r) => r.year === args.year && r.encashedDays > 0 && !r.paidAt)
      .map((r) => ({
        id: r._id,
        user_id: r.userId,
        name: names.get(r.userId as string) ?? "Unknown",
        days: r.encashedDays,
      }));
  },
});
