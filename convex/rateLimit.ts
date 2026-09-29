import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

/**
 * Distributed fixed-window rate limiter backed by Convex, so counters are
 * shared across all serverless instances (unlike the in-memory limiter used in
 * middleware). Used for the most abuse-sensitive paths (e.g. login attempts).
 * Keys are small (emails / IPs) so table growth is bounded; stale rows are
 * overwritten whenever the window elapses.
 */
export const hit = mutation({
  args: {
    secret: v.string(),
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const now = tsNow();
    let bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (!bucket || now - bucket.windowStart >= args.windowMs) {
      if (bucket) {
        await ctx.db.patch(bucket._id, { windowStart: now, count: 1 });
      } else {
        await ctx.db.insert("rateLimitBuckets", {
          key: args.key,
          windowStart: now,
          count: 1,
        });
      }
      return { allowed: true, remaining: args.limit - 1, retryAfterMs: 0 };
    }

    const count = bucket.count + 1;
    await ctx.db.patch(bucket._id, { count });
    const allowed = count <= args.limit;
    return {
      allowed,
      remaining: Math.max(0, args.limit - count),
      retryAfterMs: allowed ? 0 : bucket.windowStart + args.windowMs - now,
    };
  },
});
