import { NextRequest, NextResponse } from "next/server";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";
import { sendEmail } from "@/lib/notify";

/**
 * Scheduled self-check (Vercel cron). Verifies the Convex backend, records the
 * result for the status page, and emails the platform owners on a status
 * transition (outage or recovery).
 */

function cronAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  return req.headers.get("x-vercel-cron") === "1";
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    if (!cronAuthorized(req)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }

    // Previous status, to detect transitions.
    let prev: string | null = null;
    try {
      const s = (await cx().query(api.health.summary, { secret: secret() })) as { status: string };
      prev = s.status;
    } catch {
      prev = null;
    }

    const t0 = Date.now();
    let up = true;
    let error: string | null = null;
    try {
      await cx().query(api.health.ping, { secret: secret() });
    } catch (e) {
      up = false;
      error = e instanceof Error ? e.message : "Convex unreachable";
    }
    const latencyMs = Date.now() - t0;
    const status = up ? "up" : "down";

    await cx().mutation(api.health.recordCheck, {
      secret: secret(),
      status,
      source: "cron",
      latencyMs,
      error: error ?? undefined,
    });

    // Alert only on transitions.
    if (prev && prev !== status) {
      const recipients = (await cx().query(api.health.alertRecipients, {
        secret: secret(),
      })) as Array<{ name: string; email: string }>;

      const subject = up ? "Office Manager services recovered" : "Office Manager outage detected";
      const body = up
        ? `<p>Good news — the Office Manager platform is reachable again.</p><p>Down-time ended at ${new Date().toISOString()}.</p>`
        : `<p>The Office Manager platform detected that its backend is unreachable.</p><p>Detected at ${new Date().toISOString()}.</p>${error ? `<p>Error: ${error}</p>` : ""}`;

      for (const r of recipients) {
        await sendEmail(r.email, subject, body);
      }

      if (!up) {
        // Surface the outage in the platform console banner.
        try {
          await cx().mutation(api.health.announce, {
            secret: secret(),
            kind: "outage",
            message: "The platform backend is currently unreachable. The team has been alerted.",
          });
        } catch {
          /* ignore */
        }
      } else {
        try {
          await cx().mutation(api.health.announce, {
            secret: secret(),
            kind: "recovered",
            message: "The platform backend is reachable again. Services have recovered.",
          });
        } catch {
          /* ignore */
        }
      }
    }

    return ok({ status, latencyMs, alerted: prev !== null && prev !== status });
  });
}
