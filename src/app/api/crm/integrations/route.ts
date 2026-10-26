import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { EMAIL_PROVIDERS } from "@/lib/email/providers";

/** List the signed-in user's email connections + which providers are configured. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("crm-email", ["admin"]);
    try {
      const connections = await cx().query(api.crmEmail.listMyConnections, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
      });
      const providers = {
        gmail: { label: EMAIL_PROVIDERS.gmail.label, configured: EMAIL_PROVIDERS.gmail.configured },
        outlook: { label: EMAIL_PROVIDERS.outlook.label, configured: EMAIL_PROVIDERS.outlook.configured },
      };
      return ok({ connections, providers });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
