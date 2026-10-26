import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";
import { getEmailProvider } from "@/lib/email/providers";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-email", ["admin"]);
    const { provider: providerId } = await ctx.params;
    const provider = getEmailProvider(providerId);
    if (!provider) throw new HttpError(404, "Unknown email provider");
    try {
      await cx().mutation(api.crmEmail.disconnect, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
        provider: provider.id,
      });
      await recordAudit(session, {
        action: "crm.email.disconnect",
        module: "crm",
        summary: `Disconnected ${provider.label}`,
        targetType: "crmEmailConnection",
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
