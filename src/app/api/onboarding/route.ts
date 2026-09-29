import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Getting-started checklist state for the signed-in company. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("onboarding", ["admin", "secretary", "manager"]);
    try {
      const status = await cx().query(api.onboarding.status, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ status });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
