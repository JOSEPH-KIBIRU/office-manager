import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** Link a synced email to CRM records, or mark it ignored. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-email", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      contactId?: string | null;
      companyId?: string | null;
      leadId?: string | null;
      dealId?: string | null;
      ignored?: boolean;
    }>(req);
    try {
      await cx().mutation(api.crmEmail.updateMessage, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
        contactId: body.contactId as never,
        companyId: body.companyId as never,
        leadId: body.leadId as never,
        dealId: body.dealId as never,
        ignored: body.ignored,
      });
      await recordAudit(session, {
        action: "crm.email.update",
        module: "crm",
        summary: body.ignored !== undefined
          ? `Email ${id} ${body.ignored ? "ignored" : "restored"}`
          : `Linked email ${id}`,
        targetType: "crmEmailMessage",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
