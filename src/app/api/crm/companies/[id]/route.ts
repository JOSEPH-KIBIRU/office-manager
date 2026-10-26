import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-companies", ["admin"]);
    const { id } = await ctx.params;
    try {
      const company = await cx().query(api.crmCompanies.getCompany, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok({ company });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-companies", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      name?: string;
      domain?: string;
      industry?: string;
      website?: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      notes?: string;
      ownerId?: string | null;
      accountingContactId?: string | null;
      source?: string;
      active?: boolean;
    }>(req);
    try {
      await cx().mutation(api.crmCompanies.updateCompany, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
        name: body.name,
        domain: body.domain,
        industry: body.industry,
        website: body.website,
        phone: body.phone,
        address: body.address,
        city: body.city,
        country: body.country,
        notes: body.notes,
        ownerId: body.ownerId as never,
        accountingContactId: body.accountingContactId as never,
        source: body.source,
        active: body.active,
      });
      await recordAudit(session, {
        action: "crm.company.update",
        module: "crm",
        summary: `Updated company ${id}`,
        targetType: "crmCompany",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-companies", ["admin"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.crmCompanies.deleteCompany, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "crm.company.delete",
        module: "crm",
        summary: `Deleted company ${id}`,
        targetType: "crmCompany",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
