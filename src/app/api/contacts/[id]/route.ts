import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("invoices", ["admin", "manager", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      name?: string;
      legalName?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      company?: string;
      address?: string;
      tin?: string;
      paymentTerms?: number;
      creditLimit?: number;
      notes?: string;
      active?: boolean;
    }>(req);
    try {
      await cx().mutation(api.invoicing.updateContact, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        name: body.name,
        legalName: body.legalName,
        contactPerson: body.contactPerson,
        email: body.email,
        phone: body.phone,
        company: body.company,
        address: body.address,
        tin: body.tin,
        paymentTerms: body.paymentTerms !== undefined ? Number(body.paymentTerms) : undefined,
        creditLimit: body.creditLimit !== undefined ? Number(body.creditLimit) : undefined,
        notes: body.notes,
        active: body.active,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("invoices", ["admin", "manager", "secretary"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.invoicing.deleteContact, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
