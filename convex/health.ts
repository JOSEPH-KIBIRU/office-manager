import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret } from "./lib";

/**
 * Platform health monitoring. A scheduled self-check (Vercel cron) pings the
 * Convex backend and records the result; the status page and public /api/health
 * endpoint read from here.
 */

const MAX_CHECKS = 2000;

export const ping = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return { ok: true, time: Date.now() };
  },
});

/** Record one health check and prune the oldest entries past the cap. */
export const recordCheck = mutation({
  args: {
    secret: v.string(),
    status: v.union(v.literal("up"), v.literal("down")),
    source: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await ctx.db.insert("healthChecks", {
      status: args.status,
      source: args.source ?? "cron",
      latencyMs: args.latencyMs,
      error: args.error,
      checkedAt: Date.now(),
    });

    // Light prune: only run occasionally and remove the oldest overflow.
    const all = await ctx.db.query("healthChecks").collect();
    if (all.length > MAX_CHECKS) {
      const overflow = all.length - MAX_CHECKS;
      const sorted = all.sort((a, b) => a.checkedAt - b.checkedAt);
      const toDelete = sorted.slice(0, overflow);
      for (const c of toDelete) await ctx.db.delete(c._id);
    }
    return { ok: true, kept: Math.min(all.length, MAX_CHECKS) };
  },
});

export const listChecks = query({
  args: { secret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const all = await ctx.db.query("healthChecks").collect();
    all.sort((a, b) => b.checkedAt - a.checkedAt);
    return all.slice(0, limit).map((c) => ({
      id: c._id,
      status: c.status,
      source: c.source ?? null,
      latencyMs: c.latencyMs ?? null,
      error: c.error ?? null,
      checkedAt: c.checkedAt,
    }));
  },
});

function uptimePct(checks: { status: string; checkedAt: number }[], sinceMs: number): number | null {
  const within = checks.filter((c) => c.checkedAt >= sinceMs);
  if (within.length === 0) return null;
  const up = within.filter((c) => c.status === "up").length;
  return Math.round((up / within.length) * 1000) / 10;
}

export const summary = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db.query("healthChecks").collect();
    all.sort((a, b) => b.checkedAt - a.checkedAt);
    const now = Date.now();
    const latest = all[0] ?? null;

    // Find the most recent run of consecutive "down" checks (current incident).
    let currentDown = false;
    let downSince: number | null = null;
    if (latest && latest.status === "down") {
      currentDown = true;
      downSince = latest.checkedAt;
      for (let i = 1; i < all.length; i++) {
        if (all[i].status === "down") downSince = all[i].checkedAt;
        else break;
      }
    }

    const recentDowns = (() => {
      const events: Array<{ startedAt: number; endedAt: number | null }> = [];
      let start: number | null = null;
      for (const c of all) {
        if (c.status === "down" && start === null) start = c.checkedAt;
        if (c.status === "up" && start !== null) {
          events.push({ startedAt: start, endedAt: c.checkedAt });
          start = null;
        }
      }
      if (start !== null) events.push({ startedAt: start, endedAt: null });
      return events.slice(0, 20);
    })();

    return {
      status: latest ? latest.status : "unknown",
      lastCheckedAt: latest ? latest.checkedAt : null,
      lastLatencyMs: latest ? latest.latencyMs ?? null : null,
      currentDown,
      downSince,
      uptime: {
        "24h": uptimePct(all, now - 24 * 3600_000),
        "7d": uptimePct(all, now - 7 * 24 * 3600_000),
        "30d": uptimePct(all, now - 30 * 24 * 3600_000),
      },
      incidents: recentDowns,
      totalChecks: all.length,
    };
  },
});

/** Active super_admin accounts (for alert delivery). */
export const alertRecipients = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => u.role === "super_admin" && u.active)
      .map((u) => ({ name: u.name, email: u.email, phone: u.phone ?? null }));
  },
});

/**
 * Server-side announcement for health transitions (used by the cron). On an
 * "outage" message we post an outage banner; on "recovered" we post an info
 * banner and deactivate any active outage banners.
 */
export const announce = mutation({
  args: {
    secret: v.string(),
    kind: v.union(v.literal("outage"), v.literal("recovered")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const now = Date.now();

    if (args.kind === "recovered") {
      const actives = await ctx.db
        .query("announcements")
        .withIndex("by_active", (q) => q.eq("active", true))
        .collect();
      for (const a of actives) {
        if (a.type === "outage") await ctx.db.patch(a._id, { active: false, updatedAt: now });
      }
    }

    // Attribute to the first active super_admin so the row satisfies schema.
    const users = await ctx.db.query("users").collect();
    const sa = users.find((u) => u.role === "super_admin" && u.active);

    await ctx.db.insert("announcements", {
      message: args.message,
      type: args.kind === "outage" ? "outage" : "info",
      active: args.kind === "outage",
      createdBy: sa?._id ?? (users[0]?._id as never),
      createdAt: now,
    });
    return { ok: true };
  },
});
