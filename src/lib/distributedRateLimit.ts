import "server-only";
import { cx, secret, api } from "./convex";

/**
 * Distributed fixed-window rate limit shared across serverless instances.
 * Fails open on backend errors so a Convex blip cannot lock users out.
 */
export async function allowDistributed(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  try {
    const res = (await cx().mutation(api.rateLimit.hit, {
      secret: secret(),
      key,
      limit,
      windowMs,
    })) as { allowed: boolean; retryAfterMs?: number };
    return { allowed: !!res.allowed, retryAfterMs: Number(res.retryAfterMs ?? 0) };
  } catch {
    return { allowed: true, retryAfterMs: 0 };
  }
}
