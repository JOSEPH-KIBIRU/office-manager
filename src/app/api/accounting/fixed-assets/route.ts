import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET /api/accounting/fixed-assets */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const assets = await cx().query(api.fixedAssets.listFixedAssets, { secret: secret(), orgId: session.orgId as never });
    return ok({ assets });
  });
}

/** POST /api/accounting/fixed-assets */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{
      name: string;
      category?: string;
      purchaseDate: string;
      purchaseCost: number;
      supplierId?: string;
      location?: string;
      custodian?: string;
      usefulLifeYears: number;
      residualValue?: number;
      assetAccountCode?: string;
      accumDepAccountCode?: string;
      depExpenseAccountCode?: string;
    }>(req);
    requireFields(body, ["name", "purchaseDate", "purchaseCost", "usefulLifeYears"]);
    try {
      const res = await cx().mutation(api.fixedAssets.createFixedAsset, {
        secret: secret(),
        orgId: session.orgId as never,
        name: String(body.name),
        category: body.category,
        purchaseDate: String(body.purchaseDate),
        purchaseCost: Number(body.purchaseCost),
        supplierId: body.supplierId as never,
        location: body.location,
        custodian: body.custodian,
        usefulLifeYears: Number(body.usefulLifeYears),
        residualValue: body.residualValue !== undefined ? Number(body.residualValue) : undefined,
        assetAccountCode: body.assetAccountCode,
        accumDepAccountCode: body.accumDepAccountCode,
        depExpenseAccountCode: body.depExpenseAccountCode,
        createdBy: session.id as never,
      });
      await recordAudit(session, { action: "assets.create", module: "accounting", summary: `Created fixed asset ${body.name}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
