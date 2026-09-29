import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const READ_ROLES = ["admin", "secretary", "manager"] as const;
const WRITE_ROLES = ["admin", "secretary"] as const;

/** Accounting overview: chart balances, cash position, periods, books health. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("accounting", [...READ_ROLES]);
    try {
      await cx().mutation(api.accounting.ensure, { secret: secret(), orgId: session.orgId as never });
      const data = await cx().query(api.accounting.overview, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok(data);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Seed the chart of accounts + current-year periods (idempotent). */
export async function POST() {
  return handle(async () => {
    const session = await requirePermission("accounting", [...WRITE_ROLES]);
    try {
      await cx().mutation(api.accounting.ensure, { secret: secret(), orgId: session.orgId as never });
      return ok();
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
