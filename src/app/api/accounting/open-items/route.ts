import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";

/** GET /api/accounting/open-items?kind=invoice|bill&contactId= — open AR/AP items. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("receipts", ["admin", "secretary", "manager"]);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") === "bill" ? "bill" : "invoice";
    const contactId = url.searchParams.get("contactId") || undefined;
    const items =
      kind === "bill"
        ? await cx().query(api.subledger.listOpenBills, {
            secret: secret(),
            orgId: session.orgId as never,
            contactId: contactId as never,
          })
        : await cx().query(api.subledger.listOpenInvoices, {
            secret: secret(),
            orgId: session.orgId as never,
            contactId: contactId as never,
          });
    return ok({ items });
  });
}
