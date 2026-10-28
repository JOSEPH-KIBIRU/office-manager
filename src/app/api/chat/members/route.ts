import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const ROLES = ["admin", "secretary", "manager", "employee"];

/** Active colleagues, for starting a direct message. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("chat", ROLES);
    try {
      const members = await cx().query(api.chat.listMembers, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
      });
      return ok({ members });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
