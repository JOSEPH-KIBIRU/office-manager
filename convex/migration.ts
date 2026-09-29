import { mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

/**
 * Admin/ops-driven data migrations.
 *
 * Unlike schema changes (which Convex manages declaratively via schema.ts),
 * these are one-time data backfills. Every migration registers a `name` in the
 * `migrations` table the first time it succeeds, so reruns are no-ops — each
 * migration is guaranteed to run at most once.
 *
 * Trigger from the Convex dashboard:
 *   convex.migration.runMigrations({ secret: "<CONVEX_SERVER_SECRET>" })
 */

type MigrationArgs = {
  orgName?: string;
};

const MIGRATIONS: Record<
  string,
  (ctx: MutationCtx, args: MigrationArgs) => Promise<unknown>
> = {
  /**
   * Create the default organization (if missing) and stamp orgId onto every
   * existing document that lacks one. Safe to rerun: skips docs with orgId.
   */
  backfillOrgs: async (ctx, args) => {
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
};

/**
 * Run every registered migration not yet recorded in the `migrations` table.
 * Idempotent: already-applied migrations are skipped. Safe to call repeatedly.
 */
export const runMigrations = mutation({
  args: {
    secret: v.string(),
    orgName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    const migrationArgs: MigrationArgs = { orgName: args.orgName };

    const results: Record<string, string> = {};
    let applied = 0;

    for (const name of Object.keys(MIGRATIONS)) {
      const already = await ctx.db
        .query("migrations")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();
      if (already) {
        results[name] = "skipped";
        continue;
      }

      await MIGRATIONS[name](ctx, migrationArgs);
      await ctx.db.insert("migrations", { name, runAt: tsNow() });
      results[name] = "applied";
      applied += 1;
    }

    return { applied, results };
  },
});

/**
 * Legacy one-off org-backfill, kept for manual/backward-compatible invocation.
 * Note: this does NOT record itself in the migrations table; prefer
 * `runMigrations` so the run is tracked and idempotent across calls.
 */
export const backfillOrgs = mutation({
  args: {
    secret: v.string(),
    orgName: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return MIGRATIONS.backfillOrgs(ctx, { orgName: args.orgName });
  },
});
