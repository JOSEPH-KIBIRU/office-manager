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
      email?: string;
      phone?: string;
      company?: string;
      address?: string;
      tin?: string;
    }>(req);
    try {
      await cx().mutation(api.invoicing.updateContact, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        name: body.name,
        email: body.email,
        phone: body.phone,
        company: body.company,
        address: body.address,
        tin: body.tin,
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
