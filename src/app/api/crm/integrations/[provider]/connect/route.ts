import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { fail } from "@/lib/api";
import { getEmailProvider } from "@/lib/email/providers";
import { encryptionConfigured } from "@/lib/email/crypto";
import { signOAuthState } from "@/lib/email/state";
import { requestOrigin, emailRedirectUri } from "@/lib/email/urls";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await ctx.params;
  const provider = getEmailProvider(providerId);
  if (!provider) return fail(404, "Unknown email provider");
  if (!provider.configured) return fail(503, `${provider.label} is not configured yet.`);
  if (!encryptionConfigured()) return fail(503, "Email integration is not configured (missing encryption key).");

  let session;
  try {
    session = await requirePermission("crm-email", ["admin"]);
  } catch {
    return fail(401, "Not authenticated");
  }

  const origin = await requestOrigin();
  const state = await signOAuthState({
    userId: session.id,
    orgId: session.orgId as string,
    provider: provider.id,
  });
  return NextResponse.redirect(provider.authUrl(emailRedirectUri(origin, provider.id), state));
}
