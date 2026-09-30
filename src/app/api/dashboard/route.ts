import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

function nowCutoff(): string {
  // matches legacy: datetime('now', '-6 hours') → "YYYY-MM-DD HH:MM"
  const d = new Date(Date.now() - 6 * 3600 * 1000);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("dashboard", ["admin", "secretary", "manager", "employee"]);
    try {
      const data = await cx().query(api.dashboard.dashboardStats, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        isAdmin: session.role === "admin",
        nowCutoff: nowCutoff(),
      });
      const feed = await cx().query(api.notifications.activityFeed, {
        secret: secret(),
        orgId: session.orgId as never,
        role: session.role as never,
        userId: session.id as never,
      });
      return ok({ ...data, activity: feed.items });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
