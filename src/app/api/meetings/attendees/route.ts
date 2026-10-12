import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";

/**
 * GET /api/meetings/attendees - the active staff directory (id/name + whether
 * they are a director) used to pick meeting attendees. Gated by the "meetings"
 * module so anyone allowed to schedule meetings (role-granted) can read it.
 * The raw role is deliberately not exposed.
 */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("meetings", ["admin", "secretary", "manager", "employee"]);
    const staff = await cx().query(api.users.listUsers, {
      secret: secret(),
      orgId: session.orgId as never,
      full: false,
    });
    const users = (staff as Array<{ id: string; name: string; role: string }>).map((u) => ({
      id: u.id,
      name: u.name,
      is_director: u.role === "admin",
    }));
    return ok({ users });
  });
}
