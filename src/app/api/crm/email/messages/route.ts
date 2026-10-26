import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** List synced emails for the CRM inbox. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-email", ["admin"]);
    const p = new URL(req.url).searchParams;
    const filter = p.get("filter") ?? "unlinked";
    const limitRaw = p.get("limit");
    try {
      const messages = await cx().query(api.crmEmail.listInbox, {
        secret: secret(),
        orgId: session.orgId as never,
        filter: filter as never,
        limit: limitRaw ? Number(limitRaw) : undefined,
      });
      return ok({ messages });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
