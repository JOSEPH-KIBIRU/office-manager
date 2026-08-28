import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

type Push = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
};

export async function pushNotification(ctx: MutationCtx, orgId: string, n: Push) {
  await ctx.db.insert("notifications", {
    orgId: orgId as never,
    userId: n.userId as never,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: false,
    createdAt: tsNow(),
  });
}

/** Notify all users in the org with the given roles (defaults to admin + manager). */
export async function notifyStaff(
  ctx: MutationCtx,
  orgId: string,
  n: Push,
  roles: string[] = ["admin", "manager"]
) {
  const users = await ctx.db
    .query("users")
    .withIndex("by_org", (q) => q.eq("orgId", orgId as never))
    .collect();
  for (const u of users) {
    if (!u.active) continue;
    if (roles.includes(u.role) && u._id !== n.userId) {
      await pushNotification(ctx, orgId, { ...n, userId: u._id });
    }
  }
}

export const listForUser = query({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", args.userId as never))
      .order("desc")
      .collect();
    const mine = all.filter((n) => n.orgId === args.orgId).slice(0, 50);
    return {
      unread_count: mine.filter((n) => !n.read).length,
      items: mine.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        link: n.link ?? null,
        read: n.read,
        created_at: new Date(n.createdAt).toISOString().replace("T", " ").slice(0, 19),
      })),
    };
  },
});

export const markRead = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("notifications") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const n = await ctx.db.get(args.id);
    if (!n || n.orgId !== args.orgId) throw new Error("Notification not found");
    await ctx.db.patch(args.id, { read: true });
    return true;
  },
});

export const markAllRead = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", args.userId as never))
      .collect();
    const mine = all.filter((n) => n.orgId === args.orgId && !n.read);
    for (const n of mine) await ctx.db.patch(n._id, { read: true });
    return mine.length;
  },
});

/** Cross-module recent activity feed for the dashboard. */
export const activityFeed = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    const orgQ = (q: any) => q.eq("orgId", args.orgId as never);
    const leaves = await ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();
    const cars = await ctx.db.query("carLogs").withIndex("by_org", orgQ).collect();
    const petty = await ctx.db.query("pettyCash").withIndex("by_org", orgQ).collect();
    const meetings = await ctx.db.query("meetings").withIndex("by_org", orgQ).collect();
    const payrolls = await ctx.db.query("payrolls").withIndex("by_org", orgQ).collect();
    const minutes = await ctx.db.query("minutes").withIndex("by_org", orgQ).collect();

    const userNames = new Map<string, string>();
    const collect = async (ids: Array<string | null | undefined>) => {
      for (const id of ids) {
        if (!id || userNames.has(id)) continue;
        const u = (await ctx.db.get(id as any)) as { name?: string } | null;
        if (u?.name) userNames.set(id, u.name);
      }
    };
    await collect([
      ...leaves.map((l) => l.userId),
      ...cars.map((c) => c.requestedBy),
      ...petty.map((p) => p.requestedBy),
      ...meetings.map((m) => m.createdBy),
      ...payrolls.map((p) => p.runBy),
      ...minutes.map((m) => m.writtenBy),
    ].map((x) => x as string));

    const name = (id: unknown) => userNames.get(id as string) ?? "Someone";
    const time = (t: number) => new Date(t).toISOString().replace("T", " ").slice(0, 16);

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const items: Array<{
      id: string;
      type: string;
      title: string;
      body: string;
      time: string;
      sort: number;
      link: string;
    }> = [];

    for (const l of leaves) {
      items.push({
        id: "leave-" + l._id,
        type: "leave",
        title: `${name(l.userId)} ${l.status === "pending" ? "requested" : "updated"} leave`,
        body: `${l.leaveType} · ${l.days} day(s) · ${l.startDate} → ${l.endDate} · ${l.status}`,
        time: time(l.createdAt),
        sort: l.createdAt,
        link: "/leave",
      });
    }
    for (const c of cars) {
      items.push({
        id: "car-" + c._id,
        type: "car",
        title: `${name(c.requestedBy)} logged a car expense`,
        body: `${c.category} · ${c.vehicleReg} · KSh ${c.amount.toLocaleString("en-KE")} · ${c.status}`,
        time: time(c.createdAt),
        sort: c.createdAt,
        link: "/cars",
      });
    }
    for (const p of petty) {
      items.push({
        id: "petty-" + p._id,
        type: "petty",
        title: `${name(p.requestedBy)} requested petty cash`,
        body: `KSh ${p.amount.toLocaleString("en-KE")} · ${p.purpose} · ${p.status}`,
        time: time(p.createdAt),
        sort: p.createdAt,
        link: "/petty-cash",
      });
    }
    for (const m of meetings) {
      items.push({
        id: "meeting-" + m._id,
        type: "meeting",
        title: `Meeting "${m.title}"`,
        body: `${m.status} · ${m.scheduledAt}${m.location ? " · " + m.location : ""}`,
        time: time(m.createdAt),
        sort: m.createdAt,
        link: "/meetings",
      });
    }
    for (const p of payrolls) {
      items.push({
        id: "payroll-" + p._id,
        type: "payroll",
        title: `Payroll for ${MONTHS[p.month - 1]} ${p.year} processed`,
        body: `${p.payslips.length} payslip(s) generated`,
        time: time(p.createdAt),
        sort: p.createdAt,
        link: "/payroll",
      });
    }
    for (const m of minutes) {
      items.push({
        id: "minute-" + m._id,
        type: "minutes",
        title: `Minutes "${m.title}" saved`,
        body: `${m.status}${m.aiGenerated ? " · AI generated" : ""}`,
        time: time(m.createdAt),
        sort: m.createdAt,
        link: "/minutes",
      });
    }

    items.sort((a, b) => b.sort - a.sort);
    return { items: items.slice(0, 8) };
  },
});
