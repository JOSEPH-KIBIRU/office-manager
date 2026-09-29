import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** General ledger: posted journals (newest first) for a date range. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || undefined;
    const through = url.searchParams.get("through") || undefined;
    try {
      const journals = await cx().query(api.accounting.ledger, {
        secret: secret(),
        orgId: session.orgId as never,
        from,
        through,
      });
      return ok({ journals });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
