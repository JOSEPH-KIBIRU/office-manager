import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/**
 * Platform feature cap.
 * GET   /api/admin/features            - list companies with their enabled modules.
 * PATCH /api/admin/features            - set the enabled modules for one company.
 *         body: { orgId: string, modules: string[] | null }  (null = all enabled)
 */
export async function GET() {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    try {
      const companies = await cx().query(api.permissions.listCompaniesModules, {
        secret: secret(),
        superAdminId: session.id as never,
      });
      return ok({ companies });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const body = (await req.json().catch(() => ({}))) as {
      orgId?: string;
      modules?: string[] | null;
    };
    if (!body.orgId) throw new HttpError(400, "orgId is required");
    const modules = body.modules === null ? null : Array.isArray(body.modules) ? body.modules : [];

    try {
      const result = await cx().mutation(api.permissions.setEnabledModules, {
        secret: secret(),
        superAdminId: session.id as never,
        orgId: body.orgId as never,
        modules,
      });
      await recordAudit(
        session,
        {
          action: "features.update",
          module: "platform",
          summary:
            modules === null
              ? "Enabled all modules for company"
              : `Restricted company to ${modules.length} module(s)`,
        },
        null,
        body.orgId
      );
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
