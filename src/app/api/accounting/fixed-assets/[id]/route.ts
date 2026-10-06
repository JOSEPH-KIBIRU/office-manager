import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** PATCH /api/accounting/fixed-assets/[id] — edit or change status. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<Record<string, unknown>>(req);
    try {
      if (body.status) {
        await cx().mutation(api.fixedAssets.setFixedAssetStatus, {
          secret: secret(),
          orgId: session.orgId as never,
          id: id as never,
          status: body.status as never,
        });
        return ok({ ok: true });
      }
      await cx().mutation(api.fixedAssets.updateFixedAsset, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        name: body.name as string | undefined,
        category: body.category as string | undefined,
        location: body.location as string | undefined,
        custodian: body.custodian as string | undefined,
        usefulLifeYears: body.usefulLifeYears !== undefined ? Number(body.usefulLifeYears) : undefined,
        residualValue: body.residualValue !== undefined ? Number(body.residualValue) : undefined,
        assetAccountCode: body.assetAccountCode as string | undefined,
        accumDepAccountCode: body.accumDepAccountCode as string | undefined,
        depExpenseAccountCode: body.depExpenseAccountCode as string | undefined,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
