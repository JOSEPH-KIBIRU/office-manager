import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET / POST / PATCH /api/management/cost-centres */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("cost-centres", ["admin", "secretary", "manager"]);
    const costCentres = await cx().query(api.management.listCostCentres, { secret: secret(), orgId: session.orgId as never });
    return ok({ costCentres });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("cost-centres", ["admin", "secretary"]);
    const body = await readJson<{ name: string; type: "branch" | "department" | "location" | "cost_centre"; code?: string }>(req);
    requireFields(body, ["name", "type"]);
    try {
      const res = await cx().mutation(api.management.createCostCentre, {
        secret: secret(),
        orgId: session.orgId as never,
        name: String(body.name),
        type: body.type,
        code: body.code,
        createdBy: session.id as never,
      });
      await recordAudit(session, { action: "management.cost_centre_create", module: "management", summary: `Created ${body.type} ${body.name}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("cost-centres", ["admin", "secretary"]);
    const body = await readJson<{ id: string; name?: string; type?: "branch" | "department" | "location" | "cost_centre"; active?: boolean }>(req);
    if (!body.id) throw new Error("id is required");
    try {
      await cx().mutation(api.management.updateCostCentre, {
        secret: secret(),
        orgId: session.orgId as never,
        id: body.id as never,
        name: body.name,
        type: body.type,
        active: body.active,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
