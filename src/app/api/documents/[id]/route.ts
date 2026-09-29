import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("documents", ["admin", "secretary", "manager"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      userId?: string | null;
      title?: string;
      category?: "contract" | "license" | "insurance" | "certificate" | "other";
      issuedDate?: string | null;
      expiryDate?: string | null;
      notes?: string | null;
    }>(req);

    try {
      const res = await cx().mutation(api.documents.updateDocument, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        userId: body.userId === undefined ? undefined : (body.userId as never),
        title: body.title,
        category: body.category,
        issuedDate: body.issuedDate,
        expiryDate: body.expiryDate,
        notes: body.notes,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("documents", ["admin", "secretary", "manager"]);
    const { id } = await ctx.params;
    try {
      const res = await cx().mutation(api.documents.deleteDocument, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
