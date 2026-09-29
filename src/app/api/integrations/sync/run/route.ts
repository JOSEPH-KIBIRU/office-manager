import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/api";
import { processCalendarJobs } from "@/lib/calendar/sync";

/**
 * Scheduled calendar-sync runner. Authorised by a shared secret
 * (Authorization: Bearer CALENDAR_SYNC_SECRET, or ?key=). Called by Vercel Cron
 * and can be hit manually to drain the queue.
 */
async function run(req: NextRequest) {
  return handle(async () => {
    const expected = process.env.CALENDAR_SYNC_SECRET || process.env.CRON_SECRET;
    if (!expected) return fail(503, "Calendar sync runner is not configured");
    const auth = req.headers.get("authorization");
    const key = new URL(req.url).searchParams.get("key");
    if (auth !== `Bearer ${expected}` && key !== expected) return fail(401, "Unauthorized");
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
