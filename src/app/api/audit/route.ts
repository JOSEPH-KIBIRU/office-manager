import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/**
 * GET /api/audit?action=&module=&actorId=&limit=&before=
 * Admin-only audit trail listing (newest first), with optional filters.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("audit-log", ["admin"]);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || undefined;
    const module = url.searchParams.get("module") || undefined;
    const actorId = url.searchParams.get("actorId") || undefined;
    const limit = Number(url.searchParams.get("limit") || 200);
    const before = url.searchParams.get("before");
    try {
      const result = await cx().query(api.audit.list, {
        secret: secret(),
        orgId: session.orgId as never,
        action,
        module,
        actorId: actorId as never,
        limit: isFinite(limit) ? limit : 200,
        before: before ? Number(before) : undefined,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
