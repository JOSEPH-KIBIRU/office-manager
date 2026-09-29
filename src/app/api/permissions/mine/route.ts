import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { getEffectivePermissions } from "@/lib/permissionGuard";

/**
 * GET /api/permissions/mine - the effective module list for the signed-in user.
 * Used by the sidebar to render only the modules the current role may access.
 */
export async function GET() {
  return handle(async () => {
    const session = await requireUser();
    const modules =
      session.role === "super_admin"
        ? []
        : await getEffectivePermissions(session.orgId, session.role);
    return ok({ modules });
  });
}
