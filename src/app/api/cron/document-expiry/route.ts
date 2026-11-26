import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { notifyAdmins, escapeHtml } from "@/lib/notify";
import { cronAuthorized } from "@/lib/cronAuth";

const NOTICE_DAYS = 30;

/** Daily: notify admins about staff/company documents expiring within 30 days. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    if (!cronAuthorized(req)) {
      await requireUser(["admin"]);
    }

    let rows;
    try {
      rows = await cx().query(api.documents.expiringSoon, {
        secret: secret(),
        withinDays: NOTICE_DAYS,
        now: Date.now(),
      });
    } catch (e) {
      return mapConvexError(e);
    }

    // Group by organization.
    const byOrg = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!byOrg.has(r.orgId)) byOrg.set(r.orgId, []);
      byOrg.get(r.orgId)!.push(r);
    }

    let notified = 0;
    for (const [orgId, docs] of byOrg) {
      const lines = docs.map((d) => `${d.title}${d.userName ? ` (${d.userName})` : ""} — ${d.expired ? "EXPIRED" : "expires"} ${d.expiryDate}`);
      const safeLines = docs.map(
        (d) =>
          `${escapeHtml(d.title)}${d.userName ? ` (${escapeHtml(d.userName)})` : ""} — ${
            d.expired ? "EXPIRED" : "expires"
          } ${escapeHtml(d.expiryDate)}`
      );
      const html = `<p>The following documents need attention:</p><ul>${safeLines.map((l) => `<li>${l}</li>`).join("")}</ul>`;
      const sms = `Document expiry: ${lines.slice(0, 4).join("; ")}${lines.length > 4 ? ` (+${lines.length - 4} more)` : ""}`;
      try {
        await notifyAdmins(orgId, "Documents expiring soon", html, sms);
      } catch {
        /* ignore per-org failures */
      }
      for (const d of docs) {
        await cx().mutation(api.documents.markNotified, { secret: secret(), id: d.id as never });
        notified += 1;
      }
    }

    return ok({ expiring: rows.length, notified, organizations: byOrg.size });
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
