import { query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, fmtCreated } from "./lib";

export const dashboardStats = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    isAdmin: v.boolean(),
    nowCutoff: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const me = await ctx.db.get(args.viewerId);

    const pendingLeaves = await ctx.db
      .query("leaves")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", args.orgId).eq("status", "pending" as never)
      )
      .collect();

    const year = new Date().getFullYear().toString();

    const allOrgLeaves = await ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    const approvedThisYear = allOrgLeaves.filter(
      (l) => l.userId === args.viewerId && l.status === "approved" && l.startDate.slice(0, 4) === year
    );
    const daysTaken = approvedThisYear.reduce((sum, l) => sum + l.days, 0);
    const myPending = pendingLeaves.filter(
      (l) => l.userId === args.viewerId
    ).length;

    const pendingCount = pendingLeaves.length;

    const allCars = await ctx.db
      .query("carLogs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const allPetty = await ctx.db
      .query("pettyCash")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    let pendingLeavesList: Array<Record<string, unknown>> = [];
    if (args.isAdmin) {
      const oldestFirst = [...pendingLeaves].sort((a, b) => a.createdAt - b.createdAt).slice(0, 5);
      pendingLeavesList = await Promise.all(
        oldestFirst.map(async (l) => {
          const requester = await ctx.db.get(l.userId);
          return {
            id: l._id,
            user_id: l.userId,
            requester_name: requester?.name ?? "Unknown",
            start_date: l.startDate,
            end_date: l.endDate,
            days: l.days,
            leave_type: l.leaveType,
            reason: l.reason,
            status: l.status,
            approved_by: l.approvedBy ?? null,
            approved_at: l.approvedAt ?? null,
            admin_note: l.adminNote ?? null,
            created_at: fmtCreated(l.createdAt),
          };
        })
      );
    }

    const nowMs = Date.now();
    const weekAhead = new Date(nowMs + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const yearPrefix = new Date().getFullYear().toString();

    const pendingPetty = allPetty.filter((p) => p.status === "pending");
    const pendingCars = allCars.filter((c) => c.status === "pending");
    const pettyCashMonthly = allPetty.filter((p) => p.createdAt && new Date(p.createdAt).toISOString().slice(0, 7) === monthPrefix).length;
    const carLogsMonthly = allCars.filter((c) => c.createdAt && new Date(c.createdAt).toISOString().slice(0, 7) === monthPrefix).length;

    const allMeetings = await ctx.db
      .query("meetings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const upcoming = allMeetings
      .filter((m) => m.status === "scheduled" && m.scheduledAt >= args.nowCutoff)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, 5);
    const meetingsThisWeek = allMeetings.filter(
      (m) => m.status === "scheduled" && m.scheduledAt >= args.nowCutoff && m.scheduledAt <= weekAhead
    ).length;
    const upcomingMeetings = await Promise.all(
      upcoming.map(async (m) => {
        const creator = await ctx.db.get(m.createdBy);
        const director = m.directorId ? await ctx.db.get(m.directorId) : null;
        return {
          id: m._id,
          title: m.title,
          agenda: m.agenda ?? null,
          location: m.location ?? null,
          scheduled_at: m.scheduledAt,
          attendees: JSON.stringify(m.attendeeIds),
          director_id: m.directorId ?? null,
          director_name: director?.name ?? null,
          status: m.status,
          created_by_name: creator?.name ?? "Unknown",
          created_at: fmtCreated(m.createdAt),
        };
      })
    );

    const orgUsers = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const teamSize = orgUsers.filter((u) => u.active).length;

    return {
      stats: {
        leave_balance: me?.leaveBalance ?? 0,
        my_pending_leaves: myPending,
        days_taken_this_year: daysTaken,
        leave_taken_pct: Math.min(100, Math.round(((daysTaken + myPending) / 21) * 100)),
        pending_approvals: args.isAdmin ? pendingCount + pendingCars.length + pendingPetty.length : 0,
        pending_leaves: pendingCount,
        pending_car_logs: args.isAdmin ? pendingCars.length : 0,
        pending_petty_cash: args.isAdmin ? pendingPetty.length : 0,
        pending_petty_cash_amount: args.isAdmin ? pendingPetty.reduce((s, p) => s + p.amount, 0) : 0,
        pending_car_logs_amount: args.isAdmin ? pendingCars.reduce((s, c) => s + c.amount, 0) : 0,
        team_size: teamSize,
        meetings_this_week: meetingsThisWeek,
        meetings_total: allMeetings.length,
        petty_cash_this_month: args.isAdmin ? pettyCashMonthly : 0,
        car_logs_this_month: args.isAdmin ? carLogsMonthly : 0,
        leave_requests_total: allOrgLeaves.filter((l) => l.startDate.slice(0, 4) === yearPrefix).length,
      },
      pending_leaves_list: pendingLeavesList,
      upcoming_meetings: upcomingMeetings,
    };
  },
});
