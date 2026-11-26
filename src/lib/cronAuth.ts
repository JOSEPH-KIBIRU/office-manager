import { secureCompare } from "./secureCompare";

/**
 * Authorise a scheduled task. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set. We deliberately
 * do NOT trust the `x-vercel-cron` header (it can be spoofed by any client),
 * and we do not accept the secret in the query string where it can leak into
 * logs and referrers.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  return secureCompare(auth.slice("Bearer ".length), secret);
}
