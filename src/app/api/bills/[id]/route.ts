import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("bills", ["admin", "manager", "secretary"]);
    const { id } = await ctx.params;
    const row = await cx().query(api.bills.getBill, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    if (!row) throw new HttpError(404, "Bill not found");
    return ok({ bill: row });
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("bills", ["admin", "manager", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      contactId?: string;
      billDate?: string;
      dueDate?: string;
      amount?: number;
      vatRate?: number;
      description?: string;
    }>(req);
    try {
      await cx().mutation(api.bills.updateBill, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        contactId: body.contactId ? (body.contactId as never) : undefined,
        billDate: body.billDate,
        dueDate: body.dueDate,
        amount: body.amount !== undefined ? Number(body.amount) : undefined,
        vatRate: body.vatRate !== undefined ? Number(body.vatRate) : undefined,
        description: body.description,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("bills", ["admin", "manager", "secretary"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.bills.deleteBill, {
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
