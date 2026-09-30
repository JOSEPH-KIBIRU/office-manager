import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/**
 * GET /api/admin/audit?orgId=&action=&module=&limit=&before=
 * Full audit trail for a single company (super admin only). Unlike the
 * company-facing endpoint this includes platform (super-admin) actions.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    if (!orgId) throw new HttpError(400, "orgId is required");

    const action = url.searchParams.get("action") || undefined;
    const module = url.searchParams.get("module") || undefined;
    const limit = Number(url.searchParams.get("limit") || 200);
    const before = url.searchParams.get("before");

    try {
      const result = await cx().query(api.audit.adminList, {
        secret: secret(),
        superAdminId: session.id as never,
        orgId: orgId as never,
        action,
        module,
        limit: isFinite(limit) ? limit : 200,
        before: before ? Number(before) : undefined,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
