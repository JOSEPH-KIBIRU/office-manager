import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/api";
import { processCalendarJobs } from "@/lib/calendar/sync";
import { secureCompare } from "@/lib/secureCompare";

/**
 * Scheduled calendar-sync runner. Authorised only by
 * `Authorization: Bearer <CALENDAR_SYNC_SECRET|CRON_SECRET>`. Vercel Cron
 * sends the header automatically; the secret is never accepted in the query
 * string.
 */
function authorized(req: NextRequest): boolean {
  const candidates = [process.env.CALENDAR_SYNC_SECRET, process.env.CRON_SECRET].filter(
    (s): s is string => Boolean(s)
  );
  if (candidates.length === 0) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const supplied = auth.slice("Bearer ".length);
  return candidates.some((secret) => secureCompare(supplied, secret));
}

async function run(req: NextRequest) {
  return handle(async () => {
    const configured = Boolean(process.env.CALENDAR_SYNC_SECRET || process.env.CRON_SECRET);
    if (!configured) return fail(503, "Calendar sync runner is not configured");
    if (!authorized(req)) return fail(401, "Unauthorized");
    const summary = await processCalendarJobs(25);
    return ok(summary);
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
