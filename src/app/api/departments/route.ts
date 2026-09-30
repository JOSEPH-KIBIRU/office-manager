import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("departments", ["admin"]);
    try {
      const departments = await cx().query(api.departments.listDepartments, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      const employees = await cx().query(api.departments.listEmployees, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ departments, employees });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("departments", ["admin"]);
    const body = await readJson<{ name: string }>(req);
    requireFields(body, ["name"]);

    try {
      const id = await cx().mutation(api.departments.createDepartment, {
        secret: secret(),
        orgId: session.orgId as never,
        name: String(body.name),
      });
      return ok({ id });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return mapConvexError(e);
    }
  });
}
