import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

const ALLOWED = ["draft", "sent", "accepted", "rejected", "expired"] as const;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-quotations", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{ status?: string }>(req);
    if (!body.status || !(ALLOWED as readonly string[]).includes(body.status)) {
      throw new HttpError(400, "Status must be draft, sent, accepted, rejected or expired");
    }
    try {
      await cx().mutation(api.crmQuotations.setQuotationStatus, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
        status: body.status as never,
      });
      await recordAudit(session, {
        action: "crm.quotation.status",
        module: "crm",
        summary: `Quotation ${id} → ${body.status}`,
        targetType: "crmQuotation",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
