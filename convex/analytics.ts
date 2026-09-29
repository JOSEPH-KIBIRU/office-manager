import { query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireMember } from "./lib";

/**
 * Role-aware analytics: monthly series (last 12 months) for leave, petty cash,
 * car logs and meetings, plus headline KPIs. Admins/managers/secretaries see
 * the whole organisation; employees only see their own activity.
 */

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function last12Months(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

export const series = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    isAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    // Verify the viewer belongs to the org and derive admin from the stored role.
    await requireMember(ctx, args.orgId, args.viewerId);
    const isAdmin = (await ctx.db.get(args.viewerId))!.role === "admin";
    const months = last12Months();

    const allLeaves = await ctx.db
      .query("leaves")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const allPetty = await ctx.db
      .query("pettyCash")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const allCars = await ctx.db
      .query("carLogs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const allMeetings = await ctx.db
      .query("meetings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const allInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const allBills = await ctx.db
      .query("bills")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const allPayrolls = await ctx.db
      .query("payrolls")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const leaves = isAdmin
      ? allLeaves
      : allLeaves.filter((l) => l.userId === args.viewerId);
    const petty = isAdmin
      ? allPetty
      : allPetty.filter((p) => p.requestedBy === args.viewerId);
    const cars = isAdmin
      ? allCars
      : allCars.filter((c) => c.requestedBy === args.viewerId);

    const meetings = isAdmin
      ? allMeetings
      : allMeetings.filter(
          (m) =>
            m.createdBy === args.viewerId ||
            m.directorId === args.viewerId ||
            m.attendeeIds.includes(args.viewerId)
        );

    // Bucket builders.
    const byMonth = <T>(rows: T[], pick: (r: T) => string) => {
      const out = new Map(months.map((m) => [m, [] as T[]]));
      for (const r of rows) {
        const k = pick(r);
        if (out.has(k)) out.get(k)!.push(r);
      }
      return out;
    };

    const leavesByMonth = byMonth(leaves, (l) => (l.startDate ?? "").slice(0, 7));
    const pettyByMonth = byMonth(petty, (p) => monthKey(new Date(p.createdAt)));
    const carsByMonth = byMonth(cars, (c) => monthKey(new Date(c.createdAt)));
    const meetingsByMonth = byMonth(meetings, (m) => monthKey(new Date(m.createdAt)));

    const leaveSeries = months.map((m) => {
      const rows = leavesByMonth.get(m) ?? [];
      return {
        month: m,
        requests: rows.length,
        approved: rows.filter((l) => l.status === "approved").length,
        days: rows.filter((l) => l.status === "approved").reduce((s, l) => s + l.days, 0),
      };
    });

    const pettySeries = months.map((m) => {
      const rows = pettyByMonth.get(m) ?? [];
      const committed = rows.filter((p) => p.status === "approved" || p.status === "paid");
      return {
        month: m,
        requests: rows.length,
        committed: committed.reduce((s, p) => s + p.amount, 0),
      };
    });

    const carSeries = months.map((m) => {
      const rows = carsByMonth.get(m) ?? [];
      const approved = rows.filter((c) => c.status === "approved");
      return {
        month: m,
        requests: rows.length,
        approved: approved.reduce((s, c) => s + c.amount, 0),
      };
    });

    const meetingSeries = months.map((m) => {
      const rows = meetingsByMonth.get(m) ?? [];
      return {
        month: m,
        total: rows.length,
        completed: rows.filter((me) => me.status === "completed").length,
        cancelled: rows.filter((me) => me.status === "cancelled").length,
      };
    });

    // Finance is company-level only — employees never see it.
    const invoicesByMonth = byMonth(allInvoices, (i) => (i.issueDate ?? "").slice(0, 7));
    const billsByMonth = byMonth(allBills, (b) => (b.billDate ?? "").slice(0, 7));
    const payrollByMonth = new Map<string, number>();
    for (const p of allPayrolls) {
      const k = monthKey(new Date(p.year, p.month - 1, 1));
      const gross = p.payslips.reduce((s, sl) => s + sl.grossPay, 0);
      payrollByMonth.set(k, (payrollByMonth.get(k) ?? 0) + gross);
    }

    const financeSeries = months.map((m) => {
      const inv = invoicesByMonth.get(m) ?? [];
      const issued = inv.filter((i) => i.status !== "draft" && i.status !== "cancelled");
      const revenue = Math.round(issued.reduce((s, i) => s + i.total, 0) * 100) / 100;
      const collected = Math.round(inv.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0) * 100) / 100;
      const bills = Math.round((billsByMonth.get(m) ?? []).reduce((s, b) => s + b.amount, 0) * 100) / 100;
      const payroll = Math.round((payrollByMonth.get(m) ?? 0) * 100) / 100;
      return { month: m, revenue, collected, bills, payroll, net: Math.round((revenue - bills - payroll) * 100) / 100 };
    });

    // Headline KPIs across the whole 12-month window (current status only).
    const pendingLeaves = leaves.filter((l) => l.status === "pending").length;
    const daysApproved = leaves
      .filter((l) => l.status === "approved")
      .reduce((s, l) => s + l.days, 0);
    const pettySpend = petty
      .filter((p) => p.status === "approved" || p.status === "paid")
      .reduce((s, p) => s + p.amount, 0);
    const pettyPending = petty.filter((p) => p.status === "pending").length;
    const carSpend = cars.filter((c) => c.status === "approved").reduce((s, c) => s + c.amount, 0);
    const carPending = cars.filter((c) => c.status === "pending").length;
    const meetingsHeld = meetings.filter((m) => m.status === "completed").length;
    const meetingsUpcoming = meetings.filter((m) => m.status === "scheduled").length;

    const issuedInvoices = allInvoices.filter((i) => i.status !== "draft" && i.status !== "cancelled");
    const revenueTotal = Math.round(issuedInvoices.reduce((s, i) => s + i.total, 0) * 100) / 100;
    const collectedTotal = Math.round(allInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0) * 100) / 100;
    const outstandingTotal = Math.round(allInvoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.total, 0) * 100) / 100;
    const billsTotal = Math.round(allBills.reduce((s, b) => s + b.amount, 0) * 100) / 100;
    const payrollTotal = Math.round(allPayrolls.reduce((s, p) => s + p.payslips.reduce((a, sl) => a + sl.grossPay, 0), 0) * 100) / 100;

    return {
      months,
      scope: isAdmin ? "organization" : "personal",
      leave: leaveSeries,
      petty_cash: pettySeries,
      car_logs: carSeries,
      meetings: meetingSeries,
      finance: isAdmin ? financeSeries : [],
      summary: {
        leave_pending: pendingLeaves,
        leave_days_approved: daysApproved,
        petty_spend: pettySpend,
        petty_pending: pettyPending,
        car_spend: carSpend,
        car_pending: carPending,
        meetings_held: meetingsHeld,
        meetings_upcoming: meetingsUpcoming,
        team_size: isAdmin
          ? (await ctx.db.query("users").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect()).filter((u) => u.active).length
          : 0,
        revenue_total: isAdmin ? revenueTotal : 0,
        collected_total: isAdmin ? collectedTotal : 0,
        outstanding_total: isAdmin ? outstandingTotal : 0,
        bills_total: isAdmin ? billsTotal : 0,
        payroll_total: isAdmin ? payrollTotal : 0,
        net_total: isAdmin ? Math.round((revenueTotal - billsTotal - payrollTotal) * 100) / 100 : 0,
      },
    };
  },
});
