import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Current company plan, seat limit and user count (Team page). */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("team", ["admin", "secretary"]);
    try {
      const usage = await cx().query(api.subscriptions.getUsage, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ usage });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
