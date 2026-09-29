/**
 * Lightweight in-memory fixed-window rate limiter (used on the server: Next
 * route handlers and middleware).
 *
 * Vercel runs the app across multiple serverless instances, so this provides
 * per-instance protection. It is enough to deter naive bots and limit misuse
 * from a single client/session. Counters are pruned on access to avoid
 * unbounded growth.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Periodically clear stale buckets so the map doesn't grow without bound.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // sweep every 10 minutes
const SWEEP_EXPIRE_MS = 2 * 60 * 60 * 1000; // drop buckets idle for 2 hours

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

/**
 * Check and increment the counter for `key` inside a fixed window.
 * Returns true if the request is allowed; false if it exceeds the limit.
 */
export function rateLimit({ key, limit, windowMs }: RateLimitOptions): boolean {
  const now = Date.now();

  if (now - lastSweep > SWEEP_INTERVAL_MS) {
    lastSweep = now;
    for (const [k, b] of buckets) {
      if (now - b.windowStart > SWEEP_EXPIRE_MS + windowMs) buckets.delete(k);
    }
  }

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  return bucket.count <= limit;
}

/** Extract the most likely client IP from common forwarded headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}