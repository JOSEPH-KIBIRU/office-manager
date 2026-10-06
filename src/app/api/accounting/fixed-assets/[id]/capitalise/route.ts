import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** POST /api/accounting/fixed-assets/[id]/capitalise */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{ date?: string; payFrom?: "ap" | "bank" | "cash"; vatRate?: number }>(req);
    try {
      const res = await cx().mutation(api.fixedAssets.capitaliseAsset, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        date: body.date,
        payFrom: body.payFrom,
        vatRate: body.vatRate !== undefined ? Number(body.vatRate) : undefined,
        createdByName: session.name,
      });
      await recordAudit(session, { action: "assets.capitalise", module: "accounting", summary: `Capitalised fixed asset ${id}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
