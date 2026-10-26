import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-companies", ["admin"]);
    const q = new URL(req.url).searchParams.get("q") ?? undefined;
    try {
      const companies = await cx().query(api.crmCompanies.listCompanies, {
        secret: secret(),
        orgId: session.orgId as never,
        q,
      });
      return ok({ companies });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-companies", ["admin"]);
    const body = await readJson<{
      name: string;
      domain?: string;
      industry?: string;
      website?: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      notes?: string;
      ownerId?: string;
      accountingContactId?: string;
      source?: string;
      active?: boolean;
    }>(req);
    requireFields(body, ["name"]);
    try {
      const id = await cx().mutation(api.crmCompanies.createCompany, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        name: String(body.name),
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
        action: "crm.company.create",
        module: "crm",
        summary: `Created company "${body.name}"`,
        targetType: "crmCompany",
        targetId: String(id),
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
