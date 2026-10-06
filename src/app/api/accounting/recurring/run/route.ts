import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** POST /api/accounting/recurring/run — process due templates up to a date. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{ asOf?: string }>(req);
    try {
      const res = await cx().mutation(api.recurring.runRecurring, {
        secret: secret(),
        orgId: session.orgId as never,
        asOf: body.asOf,
        createdByName: session.name,
      });
      await recordAudit(session, { action: "recurring.run", module: "accounting", summary: `Processed ${res.processed} recurring transaction(s)` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
