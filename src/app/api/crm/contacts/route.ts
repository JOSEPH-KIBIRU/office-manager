import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-companies", ["admin"]);
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const q = url.searchParams.get("q") ?? undefined;
    try {
      const contacts = await cx().query(api.crmContacts.listContacts, {
        secret: secret(),
        orgId: session.orgId as never,
        companyId: companyId as never,
        q,
      });
      return ok({ contacts });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-companies", ["admin"]);
    const body = await readJson<{
      companyId?: string;
      name: string;
      title?: string;
      email?: string;
      phone?: string;
      linkedin?: string;
      notes?: string;
      ownerId?: string;
      accountingContactId?: string;
    }>(req);
    requireFields(body, ["name"]);
    try {
      const id = await cx().mutation(api.crmContacts.createContact, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        companyId: body.companyId as never,
        name: String(body.name),
        title: body.title,
        email: body.email,
        phone: body.phone,
        linkedin: body.linkedin,
        notes: body.notes,
        ownerId: body.ownerId as never,
        accountingContactId: body.accountingContactId as never,
      });
      await recordAudit(session, {
        action: "crm.contact.create",
        module: "crm",
        summary: `Created contact "${body.name}"`,
        targetType: "crmContact",
        targetId: String(id),
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
