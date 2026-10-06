import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** GET / POST /api/management/dimension-requirements */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("management-reports", ["admin", "secretary", "manager"]);
    const requirements = await cx().query(api.management.listDimensionRequirements, { secret: secret(), orgId: session.orgId as never });
    return ok({ requirements });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("management-reports", ["admin", "secretary"]);
    const body = await readJson<{ accountCode: string; requireCostCentre: boolean; requireProject: boolean }>(req);
    requireFields(body, ["accountCode"]);
    try {
      const res = await cx().mutation(api.management.setDimensionRequirement, {
        secret: secret(),
        orgId: session.orgId as never,
        accountCode: String(body.accountCode),
        requireCostCentre: !!body.requireCostCentre,
        requireProject: !!body.requireProject,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
