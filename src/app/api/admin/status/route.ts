import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/**
 * GET /api/admin/status - platform health summary and recent checks (super admin).
 */
export async function GET() {
  return handle(async () => {
    await requireUser(["super_admin"]);
    try {
      const [summary, checks] = await Promise.all([
        cx().query(api.health.summary, { secret: secret() }),
        cx().query(api.health.listChecks, { secret: secret(), limit: 100 }),
      ]);
      return ok({ summary, checks });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
