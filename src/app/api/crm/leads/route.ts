import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-leads", ["admin"]);
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const q = url.searchParams.get("q") ?? undefined;
    try {
      const leads = await cx().query(api.crmLeads.listLeads, {
        secret: secret(),
        orgId: session.orgId as never,
        status: status as never,
        q,
      });
      return ok({ leads });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-leads", ["admin"]);
    const body = await readJson<{
      companyName?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      source?: string;
      ownerId?: string;
      value?: number;
      notes?: string;
    }>(req);
    try {
      const id = await cx().mutation(api.crmLeads.createLead, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        companyName: body.companyName,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        source: body.source,
        ownerId: body.ownerId as never,
        value: body.value,
        notes: body.notes,
      });
      await recordAudit(session, {
        action: "crm.lead.create",
        module: "crm",
        summary: `Created lead "${body.companyName ?? body.contactName ?? body.email ?? id}"`,
        targetType: "crmLead",
        targetId: String(id),
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
