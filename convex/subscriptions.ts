import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret } from "./lib";
import { assertSuperAdmin } from "./superadmin";

/**
 * Subscription billing.
 *
 * Plans (set by the platform super admin, per company):
 *   - starter      : up to 10 users (incl. admin)  — Ksh 3,500 / month, first month free trial
 *   - professional : 11–20 users                    — Ksh 8,000 / month
 *   - enterprise   : 20+ staff                      — contact us
 *   - annual billing gets a 5% discount on the monthly price.
 *
 * A subscription lives in its own table keyed by orgId. On the 1st of every
 * month a Convex cron (`processSubscriptionRenewals`) cancels any subscription
 * whose paid period has ended without a payment being recorded (markPaid).
 */

export const PLAN = v.union(
  v.literal("starter"),
  v.literal("professional"),
  v.literal("enterprise")
);
export const CYCLE = v.union(v.literal("monthly"), v.literal("annual"));
export const STATUS = v.union(
  v.literal("trial"),
  v.literal("active"),
  v.literal("canceled"),
  v.literal("past_due")
);

const TRIAL_MS = 30 * 24 * 60 * 60 * 1000;

function addMonths(from: number, months: number): number {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

function nextPeriodEnd(cycle: "monthly" | "annual", from = Date.now()): number {
  return addMonths(from, cycle === "annual" ? 12 : 1);
}

async function findForOrg(ctx: any, orgId: string) {
  return ctx.db
    .query("subscriptions")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .unique();
}

/** The calling company's own subscription (any authenticated member). */
export const getSubscription = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const sub = await findForOrg(ctx, args.orgId);
    if (!sub) return null;
    return {
      plan: sub.plan,
      billingCycle: sub.billingCycle,
      status: sub.status,
      trialEndsAt: sub.trialEndsAt ?? null,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  },
});

/** All companies with subscription + live user counts (super admin). */
export const listCompanySubscriptions = query({
  args: { secret: v.string(), superAdminId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const orgs = await ctx.db.query("organizations").collect();
    const out = [];
    for (const o of orgs.filter((x) => x.slug !== "__platform").sort((a, b) => a.name.localeCompare(b.name))) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_org", (q) => q.eq("orgId", o._id))
        .collect();
      const sub = await findForOrg(ctx, o._id);
      out.push({
        id: o._id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        userCount: users.length,
        plan: sub?.plan ?? null,
        billingCycle: sub?.billingCycle ?? null,
        status: sub?.status ?? null,
        trialEndsAt: sub?.trialEndsAt ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      });
    }
    return out;
  },
});

/** Start the one-month free trial for a company. */
export const startTrial = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), plan: PLAN, billingCycle: CYCLE },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");
    const now = Date.now();
    const trialEndsAt = now + TRIAL_MS;
    const existing = await findForOrg(ctx, args.orgId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        plan: args.plan,
        billingCycle: args.billingCycle,
        status: "trial",
        trialEndsAt,
        currentPeriodEnd: trialEndsAt,
        cancelAtPeriodEnd: false,
      });
      return { orgId: args.orgId, trialEndsAt };
    }
    await ctx.db.insert("subscriptions", {
      orgId: args.orgId,
      plan: args.plan,
      billingCycle: args.billingCycle,
      status: "trial",
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      cancelAtPeriodEnd: false,
      userCount: 0,
      startedAt: now,
    });
    return { orgId: args.orgId, trialEndsAt };
  },
});

/** Super admin sets a company's plan, billing cycle and status. */
export const setSubscriptionPlan = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    orgId: v.id("organizations"),
    plan: PLAN,
    billingCycle: CYCLE,
    status: v.optional(STATUS),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");
    const now = Date.now();
    const existing = await findForOrg(ctx, args.orgId);
    const status = args.status ?? existing?.status ?? "active";
    if (existing) {
      await ctx.db.patch(existing._id, {
        plan: args.plan,
        billingCycle: args.billingCycle,
        status,
        currentPeriodEnd: existing.currentPeriodEnd ?? nextPeriodEnd(args.billingCycle, now),
      });
      return { orgId: args.orgId, plan: args.plan, billingCycle: args.billingCycle, status };
    }
    await ctx.db.insert("subscriptions", {
      orgId: args.orgId,
      plan: args.plan,
      billingCycle: args.billingCycle,
      status,
      currentPeriodEnd: nextPeriodEnd(args.billingCycle, now),
      cancelAtPeriodEnd: false,
      userCount: 0,
      startedAt: now,
    });
    return { orgId: args.orgId, plan: args.plan, billingCycle: args.billingCycle, status };
  },
});

/** Record a payment: activate the plan and advance the paid period. */
export const markPaid = mutation({
  args: { secret: v.string(), superAdminId: v.id("users"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const sub = await findForOrg(ctx, args.orgId);
    if (!sub) throw new Error("Subscription not found");
    const now = Date.now();
    const from = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    await ctx.db.patch(sub._id, {
      status: "active",
      trialEndsAt: undefined,
      currentPeriodEnd: nextPeriodEnd(sub.billingCycle, from),
      cancelAtPeriodEnd: false,
    });
    return { orgId: args.orgId, currentPeriodEnd: nextPeriodEnd(sub.billingCycle, from) };
  },
});

/** Cancel a subscription (effective immediately). */
export const cancelSubscription = mutation({
  args: { secret: v.string(), superAdminId: v.id("users"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const sub = await findForOrg(ctx, args.orgId);
    if (!sub) throw new Error("Subscription not found");
    await ctx.db.patch(sub._id, { status: "canceled", cancelAtPeriodEnd: true });
    return { orgId: args.orgId };
  },
});

/**
 * Cron (1st of every month): cancel any subscription whose paid period has
 * ended without payment, or whose trial has expired.
 */
export const processSubscriptionRenewals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const subs = await ctx.db.query("subscriptions").collect();
    let canceled = 0;
    for (const s of subs) {
      if (s.status === "canceled") continue;
      const periodEnded = s.currentPeriodEnd !== undefined && s.currentPeriodEnd <= now;
      const trialExpired = s.status === "trial" && s.trialEndsAt !== undefined && s.trialEndsAt <= now;
      if (periodEnded || trialExpired || s.cancelAtPeriodEnd) {
        await ctx.db.patch(s._id, { status: "canceled", cancelAtPeriodEnd: true });
        canceled++;
      }
    }
    return { checked: subs.length, canceled };
  },
});
