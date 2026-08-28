import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

/**
 * One-time migration: creates the default organization (if missing) and
 * stamps orgId onto every existing document that lacks one.
 * Safe to run multiple times — skips docs that already have an orgId.
 */
export const backfillOrgs = mutation({
  args: {
    secret: v.string(),
    orgName: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    let org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", "default"))
      .unique();
    if (!org) {
      const orgId = await ctx.db.insert("organizations", {
        name: args.orgName || "Office",
        slug: "default",
        active: true,
        createdAt: tsNow(),
      });
      org = await ctx.db.get(orgId);
    }
    if (!org) throw new Error("Failed to create default organization");
    const orgId = org._id;

    const counts: Record<string, number> = {};

    for (const u of await ctx.db.query("users").collect()) {
      if (!u.orgId) {
        await ctx.db.patch(u._id, { orgId });
        counts.users = (counts.users ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("leaves").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.leaves = (counts.leaves ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("carLogs").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.carLogs = (counts.carLogs ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("pettyCash").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.pettyCash = (counts.pettyCash ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("meetings").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.meetings = (counts.meetings ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("minutes").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.minutes = (counts.minutes ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("profileRequests").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.profileRequests = (counts.profileRequests ?? 0) + 1;
      }
    }
    for (const d of await ctx.db.query("annualReset").collect()) {
      if (!d.orgId) {
        await ctx.db.patch(d._id, { orgId });
        counts.annualReset = (counts.annualReset ?? 0) + 1;
      }
    }

    return { orgId, migrated: counts };
  },
});
