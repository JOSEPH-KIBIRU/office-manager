import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** POST /api/accounting/fixed-assets/[id]/dispose */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{ date: string; proceeds: number; proceedsAccountCode?: string }>(req);
    if (!body.date) throw new HttpError(400, "A disposal date is required");
    try {
      const res = await cx().mutation(api.fixedAssets.disposeAsset, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        date: String(body.date),
        proceeds: Number(body.proceeds ?? 0),
        proceedsAccountCode: body.proceedsAccountCode,
        createdByName: session.name,
      });
      await recordAudit(session, { action: "assets.dispose", module: "accounting", summary: `Disposed fixed asset ${id}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
