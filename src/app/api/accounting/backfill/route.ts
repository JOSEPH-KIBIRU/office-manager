import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Post journals for documents created before auto-posting existed. */
export async function POST() {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin"]);
    try {
      const result = await cx().mutation(api.accounting.backfill, {
        secret: secret(),
        orgId: session.orgId as never,
        postedByName: session.name,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
