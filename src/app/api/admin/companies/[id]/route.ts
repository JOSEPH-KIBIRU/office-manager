import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{ active: boolean }>(req);
    requireFields(body, ["active"]);
    if (typeof body.active !== "boolean") throw new HttpError(400, "active must be a boolean");
    try {
      const result = await cx().mutation(api.superadmin.setCompanyActive, {
        secret: secret(),
        superAdminId: session.id as never,
        orgId: id as never,
        active: body.active,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
