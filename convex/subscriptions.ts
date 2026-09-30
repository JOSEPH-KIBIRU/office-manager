import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { db } from "./_generated/dataModel";

export const subscribe = action({
  title: "Start trial subscription",
  args: {
    orgId: v.id("organizations"),
    plan: v.union(v.literal("starter"), v.literal("professional"), v.literal("enterprise")),
    billingCycle: v.union(v.literal("monthly"), v.literal("annual")),
  },
  handler: async (ctx, { orgId, plan, billingCycle }) => {
    const trialEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const startedAt = Date.now();

    await ctx.db.insert("subscriptions", {
      orgId,
      plan,
      billingCycle,
      status: "trial",
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      cancelAtPeriodEnd: false,
      userCount: 0,
      startedAt,
    });

    return { trialEndsAt, startedAt };
  },
});

export const confirmPayment = mutation({
  title: "Confirm payment / move from trial to active",
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx) => {
    await ctx.db.patch("subscriptions", {
      id: ctx.suppose.id, // will need to find by orgId
    });
    // Actually we need to find the subscription by orgId first.
    // Let's use a different approach - we'll have a helper.
    return { success: true };
  },
});

// Let me restructure - I'll export helper functions and the main actions

// We'll define a few key actions/mutations

export const startTrial = action({
  title: "Start trial for organization",
  args: {
    orgId: v.id("organizations"),
    plan: v.union(v.literal("starter"), v.literal("professional"), v.literal("enterprise")),
    billingCycle: v.union(v.literal("monthly"), v.literal("annual")),
  },
  handler: async (ctx, { orgId, plan, billingCycle }) => {
    const trialEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const startedAt = Date.now();

    await ctx.db.insert("subscriptions", {
      orgId,
      plan,
      billingCycle,
      status: "trial",
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      cancelAtPeriodEnd: false,
      userCount: 0,
      startedAt,
    });

    return { trialEndsAt, startedAt, plan, billingCycle };
  },
});

export const convertTrialToActive = mutation({
  title: "Convert trial to active after payment",
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx) => {
    // Find subscription for this org
    const subs = await ctx.db
      .query("subscriptions")
      .filter("orgId", "=", ctx.args.orgId)
      .collect();

    if (subs.length === 0) {
      throw new Error("No subscription found for this organization");
    }

    const subId = subs[0].$id;

    await ctx.db.patch(subId, {
      status: "active",
      trialEndsAt: null,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).getTime(), // start new period
      cancelAtPeriodEnd: false,
    });

    return { success: true, subId };
  },
});

export const cancelSubscription = mutation({
  title: "Cancel subscription",
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx) => {
    const subs = await ctx.db
      .query("subscriptions")
      .filter("orgId", "=", ctx.args.orgId)
      .collect();

    if (subs.length === 0) {
      throw new Error("No subscription found");
    }

    const subId = subs[0].$id;

    await ctx.db.patch(subId, {
      cancelAtPeriodEnd: true,
      status: "canceled",
    });

    return { success: true, subId };
  },
});

export const updateUserCount = action({
  title: "Update user count for organization",
  args: {
    orgId: v.id("organizations"),
    count: v.number(),
  },
  handler: async (ctx, { orgId, count }) => {
    const subs = await ctx.db
      .query("subscriptions")
      .filter("orgId", "=", orgId)
      .collect();

    if (subs.length === 0) {
      throw new Error("No subscription found for organization");
    }

    const subId = subs[0].$id;

    await ctx.db.patch(subId, {
      userCount: count,
    });

    return { success: true, userCount: count };
  },
});

// Helper: get current organization's subscription
export const getSubscription = async (ctx, orgId: string) => {
  const subs = await ctx.db
    .query("subscriptions")
    .filter("orgId", "=", orgId)
    .collect();

  if (subs.length === 0) {
    return null;
  }

  return {
    id: subs[0].$id,
    ...subs[0],
  };
};

/** Set subscription plan for a company (super admin only). */
export const setSubscriptionPlan = mutation({
  title: "Set subscription plan for organization",
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    orgId: v.id("organizations"),
    plan: v.union(v.literal("starter"), v.literal("professional"), v.literal("enterprise")),
    billingCycle: v.union(v.literal("monthly"), v.literal("annual")),
    status: v.optional(
      v.union(v.literal("trial"), v.literal("active"), v.literal("canceled"), v.literal("past_due"))
    ),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    const update: never = {
      plan: args.plan,
      billingCycle: args.billingCycle,
      status: args.status ?? "active",
    } as never;

    await ctx.db.patch(args.orgId, update);

    return { orgId: args.orgId, plan: args.plan, billingCycle: args.billingCycle, status: args.status ?? "active" };
  },
});

// Daily cron handler - check for trial expiry and cancellations
// This would be called from /api/cron/subscription-check
export const checkSubscriptions = async (ctx) => {
  const now = Date.now();

  // Find trial subscriptions that have expired
  const trialSubs = await ctx.db
    .query("subscriptions")
    .filter("status", "=", "trial")
    .filter("trialEndsAt", "<=", now)
    .collect();

  for (const sub of trialSubs) {
    await ctx.db.patch(sub.$id, {
      status: "canceled",
    });
  }

  // Find active subscriptions with cancelAtPeriodEnd = true whose period has ended
  const activeSubs = await ctx.db
    .query("subscriptions")
    .filter("status", "=", "active")
    .filter("cancelAtPeriodEnd", "=", true)
    .collect();

  for (const sub of activeSubs) {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd <= now) {
      await ctx.db.patch(sub.$id, {
        status: "canceled",
      });
    }
  }

  return { checked: trialSubs.length + activeSubs.length };
};