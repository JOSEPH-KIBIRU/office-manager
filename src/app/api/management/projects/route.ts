import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET / POST / PATCH /api/management/projects */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("projects", ["admin", "secretary", "manager"]);
    const projects = await cx().query(api.management.listProjects, { secret: secret(), orgId: session.orgId as never });
    return ok({ projects });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("projects", ["admin", "secretary"]);
    const body = await readJson<{
      name: string;
      customerId?: string;
      startDate?: string;
      endDate?: string;
      budget?: number;
      code?: string;
    }>(req);
    requireFields(body, ["name"]);
    try {
      const res = await cx().mutation(api.management.createProject, {
        secret: secret(),
        orgId: session.orgId as never,
        name: String(body.name),
        customerId: body.customerId as never,
        startDate: body.startDate,
        endDate: body.endDate,
        budget: body.budget !== undefined ? Number(body.budget) : undefined,
        code: body.code,
        createdBy: session.id as never,
      });
      await recordAudit(session, { action: "management.project_create", module: "management", summary: `Created project ${body.name}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("projects", ["admin", "secretary"]);
    const body = await readJson<{
      id: string;
      name?: string;
      customerId?: string | null;
      startDate?: string;
      endDate?: string;
      budget?: number;
      status?: "draft" | "active" | "on_hold" | "completed";
      active?: boolean;
    }>(req);
    if (!body.id) throw new Error("id is required");
    try {
      await cx().mutation(api.management.updateProject, {
        secret: secret(),
        orgId: session.orgId as never,
        id: body.id as never,
        name: body.name,
        customerId: body.customerId === undefined ? undefined : (body.customerId as never),
        startDate: body.startDate,
        endDate: body.endDate,
        budget: body.budget !== undefined ? Number(body.budget) : undefined,
        status: body.status,
        active: body.active,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
