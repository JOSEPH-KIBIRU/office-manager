import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/api";
import { processEmailSync } from "@/lib/email/sync";
import { secureCompare } from "@/lib/secureCompare";

export const maxDuration = 60;

/**
 * Scheduled email-sync runner. Authorised only by
 * `Authorization: Bearer <CRM_EMAIL_SYNC_SECRET|CRON_SECRET>`. A calendar-sync
 * secret must not grant access to mailbox sync, and the secret is never
 * accepted in the query string.
 */
function authorized(req: NextRequest): boolean {
  const candidates = [process.env.CRM_EMAIL_SYNC_SECRET, process.env.CRON_SECRET].filter(
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
    const configured = Boolean(process.env.CRM_EMAIL_SYNC_SECRET || process.env.CRON_SECRET);
    if (!configured) return fail(503, "Email sync runner is not configured");
    if (!authorized(req)) return fail(401, "Unauthorized");
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
