import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/api";
import { processEmailSync } from "@/lib/email/sync";

export const maxDuration = 60;

/**
 * Scheduled email-sync runner. Authorised by a shared secret
 * (Authorization: Bearer <secret>, or ?key=<secret>).
 */
async function run(req: NextRequest) {
  return handle(async () => {
    // Accept any configured runner secret (Vercel Cron sends CRON_SECRET).
    const candidates = [
      process.env.CRM_EMAIL_SYNC_SECRET,
      process.env.CALENDAR_SYNC_SECRET,
      process.env.CRON_SECRET,
    ].filter((s): s is string => Boolean(s));
    if (candidates.length === 0) return fail(503, "Email sync runner is not configured");
    const auth = req.headers.get("authorization");
    const key = new URL(req.url).searchParams.get("key");
    const authorized = candidates.some((s) => auth === `Bearer ${s}` || key === s);
    if (!authorized) return fail(401, "Unauthorized");
    const summary = await processEmailSync(10);
    return ok(summary);
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
