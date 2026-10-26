import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/api";
import { processEmailSync } from "@/lib/email/sync";

/**
 * Scheduled email-sync runner. Authorised by a shared secret
 * (Authorization: Bearer <secret>, or ?key=<secret>).
 */
async function run(req: NextRequest) {
  return handle(async () => {
    const expected =
      process.env.CRM_EMAIL_SYNC_SECRET ||
      process.env.CALENDAR_SYNC_SECRET ||
      process.env.CRON_SECRET;
    if (!expected) return fail(503, "Email sync runner is not configured");
    const auth = req.headers.get("authorization");
    const key = new URL(req.url).searchParams.get("key");
    if (auth !== `Bearer ${expected}` && key !== expected) return fail(401, "Unauthorized");
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
