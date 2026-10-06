import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** POST /api/accounting/fixed-assets/depreciation — run depreciation for a period. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{ period: string }>(req);
    if (!body.period || !/^\d{4}-\d{2}$/.test(body.period)) throw new HttpError(400, "A period (YYYY-MM) is required");
    try {
      const res = await cx().mutation(api.fixedAssets.runDepreciation, {
        secret: secret(),
        orgId: session.orgId as never,
        period: body.period,
        createdByName: session.name,
      });
      await recordAudit(session, {
        action: "assets.depreciation",
        module: "accounting",
        summary: `Ran depreciation for ${body.period} (${res.posted} asset(s), KES ${res.total.toLocaleString("en-KE")})`,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
