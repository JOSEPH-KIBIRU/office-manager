import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";
import { syncConnectionById } from "@/lib/email/sync";

/** Sync the signed-in user's connected mailboxes now (instead of waiting for cron). */
export async function POST() {
  return handle(async () => {
    const session = await requirePermission("crm-email", ["admin"]);
    try {
      const connections = await cx().query(api.crmEmail.listMyConnections, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
      });
      for (const c of connections) {
        await syncConnectionById(c.id);
      }
      await recordAudit(session, {
        action: "crm.email.sync",
        module: "crm",
        summary: `Synced ${connections.length} mailbox(es)`,
      });
      return ok({ synced: connections.length });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
