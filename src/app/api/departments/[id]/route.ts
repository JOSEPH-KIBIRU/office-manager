import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{ name: string }>(req);

    try {
      await cx().mutation(api.departments.renameDepartment, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        name: body.name,
      });
      return ok();
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;

    try {
      const result = await cx().mutation(api.departments.deleteDepartment, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
