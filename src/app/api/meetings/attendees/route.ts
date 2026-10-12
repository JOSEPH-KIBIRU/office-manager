import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";

/**
 * GET /api/meetings/attendees — the active staff directory (id/name/role) used
 * to pick meeting attendees. Gated by the "meetings" module so anyone allowed to
 * schedule meetings (role-granted) can read it, not just admin/secretary.
 */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("meetings", ["admin", "secretary", "manager", "employee"]);
    const users = await cx().query(api.users.listUsers, {
      secret: secret(),
      orgId: session.orgId as never,
      full: false,
    });
    return ok({ users });
  });
}
