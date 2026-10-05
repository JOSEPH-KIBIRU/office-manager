import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";

/** GET /api/accounting/aging?type=ar|ap — AR/AP aging by customer/supplier. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const type = new URL(req.url).searchParams.get("type") === "ap" ? "ap" : "ar";
    const data = await cx().query(api.subledger.aging, {
      secret: secret(),
      orgId: session.orgId as never,
      type,
    });
    return ok(data);
  });
}
