import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";

/** GET /api/accounting/contact-ledger?contactId= — customer/supplier statement of account. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const contactId = new URL(req.url).searchParams.get("contactId");
    if (!contactId) throw new HttpError(400, "contactId is required");
    const data = await cx().query(api.subledger.contactLedger, {
      secret: secret(),
      orgId: session.orgId as never,
      contactId: contactId as never,
    });
    return ok(data);
  });
}
