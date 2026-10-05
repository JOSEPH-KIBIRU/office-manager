import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/**
 * POST /api/banking/auto-match
 * Body: { accountCode, windowDays? }
 * Pairs statement entries with recorded Cash Book entries (same direction,
 * same amount, within a date window) and records the matches.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{ accountCode?: string; windowDays?: number }>(req);
    if (!body.accountCode) throw new HttpError(400, "accountCode is required");
    try {
      const res = await cx().mutation(api.banking.autoMatch, {
        secret: secret(),
        orgId: session.orgId as never,
        accountCode: body.accountCode,
        windowDays: body.windowDays !== undefined ? Number(body.windowDays) : undefined,
        createdByName: session.name,
      });
      await recordAudit(session, {
        action: "banking.auto_match",
        module: "banking",
        summary: `Auto-matched ${res.matched} item(s) for ${body.accountCode}`,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
