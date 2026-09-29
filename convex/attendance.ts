import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireMember, tsNow } from "./lib";

const EAT_OFFSET = 3 * 3600_000; // Kenya is UTC+3 (no DST)

/** Local (EAT) calendar date for a timestamp. */
function eatDate(ms: number): string {
  return new Date(ms + EAT_OFFSET).toISOString().slice(0, 10);
}

/** Minutes past midnight for an "HH:MM" string. */
function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Epoch ms for `minutes` past midnight on an EAT calendar date. */
function atDateMinutes(date: string, minutes: number): number {
  return Date.parse(date + "T00:00:00Z") - EAT_OFFSET + minutes * 60_000;
}

export const clockIn = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    const now = tsNow();
    const date = eatDate(now);
    const rows = await ctx.db
      .query("attendance")
      .withIndex("by_org_date", (q) => q.eq("orgId", args.orgId).eq("date", date))
      .collect();
    const mine = rows.find((r) => r.userId === args.userId);
    if (mine && !mine.clockOutAt) throw new Error("You are already clocked in.");
    if (mine && mine.clockOutAt) throw new Error("You have already clocked out today.");
    const id = await ctx.db.insert("attendance", {
      orgId: args.orgId,
      userId: args.userId,
      date,
      clockInAt: now,
      note: args.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
    return { id, date };
  },
});

export const clockOut = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    const now = tsNow();
    const date = eatDate(now);
    const rows = await ctx.db
      .query("attendance")
      .withIndex("by_org_date", (q) => q.eq("orgId", args.orgId).eq("date", date))
      .collect();
    const mine = rows.find((r) => r.userId === args.userId);
    if (!mine) throw new Error("You have not clocked in today.");
    if (mine.clockOutAt) throw new Error("You have already clocked out today.");
    await ctx.db.patch(mine._id, {
      clockOutAt: now,
      note: args.note?.trim() || mine.note,
      updatedAt: now,
    });
    return { id: mine._id };
  },
});

/** Today's attendance record for the viewer (or null). */
export const today = query({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    const date = eatDate(Date.now());
    const rows = await ctx.db
      .query("attendance")
      .withIndex("by_org_date", (q) => q.eq("orgId", args.orgId).eq("date", date))
      .collect();
    const mine = rows.find((r) => r.userId === args.userId);
    return mine
      ? { id: mine._id, date: mine.date, clock_in_at: mine.clockInAt, clock_out_at: mine.clockOutAt ?? null }
      : null;
  },
});

/** Attendance records. Admins/managers see the whole team; employees see their own. */
export const list = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    userId: v.optional(v.id("users")),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const viewer = await requireMember(ctx, args.orgId, args.viewerId);
    const seeAll = viewer.role !== "employee";

    let rows = await ctx.db
      .query("attendance")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (!seeAll) rows = rows.filter((r) => r.userId === args.viewerId);
    if (args.userId) rows = rows.filter((r) => r.userId === args.userId);
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.clockInAt - a.clockInAt));

    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const names = new Map(users.map((u) => [u._id as string, u.name]));

    const org = await ctx.db.get(args.orgId);
    const startMin = minutesOf(org?.workStartTime ?? "08:00");
    const endMin = minutesOf(org?.workEndTime ?? "17:00");
    const grace = org?.graceMinutes ?? 15;

    return rows.map((r) => {
      const workStart = atDateMinutes(r.date, startMin);
      const workEnd = atDateMinutes(r.date, endMin);
      const workedMs = r.clockOutAt ? r.clockOutAt - r.clockInAt : 0;
      const late = r.clockInAt > workStart + grace * 60_000;
      const overtimeMs = r.clockOutAt && r.clockOutAt > workEnd ? r.clockOutAt - workEnd : 0;
      return {
        id: r._id,
        user_id: r.userId,
        name: names.get(r.userId as string) ?? "Unknown",
        date: r.date,
        clock_in_at: r.clockInAt,
        clock_out_at: r.clockOutAt ?? null,
        worked_minutes: Math.round(workedMs / 60_000),
        late,
        overtime_minutes: Math.round(overtimeMs / 60_000),
        note: r.note ?? null,
      };
    });
  },
});

/** Per-user totals for a month — used to prefill payroll overtime. */
export const monthlySummary = query({
  args: { secret: v.string(), orgId: v.id("organizations"), month: v.number(), year: v.number() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const prefix = `${args.year}-${String(args.month).padStart(2, "0")}`;
    const org = await ctx.db.get(args.orgId);
    const startMin = minutesOf(org?.workStartTime ?? "08:00");
    const endMin = minutesOf(org?.workEndTime ?? "17:00");
    const grace = org?.graceMinutes ?? 15;

    const rows = await ctx.db
      .query("attendance")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const names = new Map(users.map((u) => [u._id as string, u.name]));

    const agg = new Map<string, { days: number; workedMin: number; overtimeMin: number; late: number }>();
    for (const r of rows) {
      if (!r.date.startsWith(prefix)) continue;
      const key = r.userId as string;
      const cur = agg.get(key) ?? { days: 0, workedMin: 0, overtimeMin: 0, late: 0 };
      cur.days += 1;
      const workStart = atDateMinutes(r.date, startMin);
      if (r.clockInAt > workStart + grace * 60_000) cur.late += 1;
      if (r.clockOutAt) {
        cur.workedMin += Math.round((r.clockOutAt - r.clockInAt) / 60_000);
        const workEnd = atDateMinutes(r.date, endMin);
        if (r.clockOutAt > workEnd) cur.overtimeMin += Math.round((r.clockOutAt - workEnd) / 60_000);
      }
      agg.set(key, cur);
    }

    return users.map((u) => {
      const a = agg.get(u._id as string) ?? { days: 0, workedMin: 0, overtimeMin: 0, late: 0 };
      return {
        user_id: u._id,
        name: u.name,
        days_present: a.days,
        worked_hours: Math.round((a.workedMin / 60) * 10) / 10,
        overtime_hours: Math.round((a.overtimeMin / 60) * 10) / 10,
        late_days: a.late,
      };
    });
  },
});
