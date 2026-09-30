import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Unpaid leave-encashment days for a year (admin). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("leave", ["admin"]);
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year") || new Date().getFullYear());
    try {
      const encashments = await cx().query(api.leaves.listEncashments, {
        secret: secret(),
        orgId: session.orgId as never,
        year,
      });
      return ok({ encashments });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
