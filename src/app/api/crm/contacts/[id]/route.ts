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
      const contact = await cx().query(api.crmContacts.getContact, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok({ contact });
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
      companyId?: string | null;
      name?: string;
      title?: string;
      email?: string;
      phone?: string;
      linkedin?: string;
      notes?: string;
      ownerId?: string | null;
      accountingContactId?: string | null;
    }>(req);
    try {
      await cx().mutation(api.crmContacts.updateContact, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
        companyId: body.companyId as never,
        name: body.name,
        title: body.title,
        email: body.email,
        phone: body.phone,
        linkedin: body.linkedin,
        notes: body.notes,
        ownerId: body.ownerId as never,
        accountingContactId: body.accountingContactId as never,
      });
      await recordAudit(session, {
        action: "crm.contact.update",
        module: "crm",
        summary: `Updated contact ${id}`,
        targetType: "crmContact",
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
      await cx().mutation(api.crmContacts.deleteContact, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "crm.contact.delete",
        module: "crm",
        summary: `Deleted contact ${id}`,
        targetType: "crmContact",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
