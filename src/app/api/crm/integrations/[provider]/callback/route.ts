import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { fail } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { getEmailProvider } from "@/lib/email/providers";
import { encryptToken, encryptionConfigured } from "@/lib/email/crypto";
import { verifyOAuthState } from "@/lib/email/state";
import { requestOrigin, emailRedirectUri } from "@/lib/email/urls";
import { queueEmailSync } from "@/lib/email/sync";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await ctx.params;
  const provider = getEmailProvider(providerId);
  if (!provider) return fail(404, "Unknown email provider");

  const origin = await requestOrigin();
  const back = (status: string) =>
    NextResponse.redirect(`${origin}/crm/email?email=${status}&provider=${providerId}`);

  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back("error");

  const parsed = await verifyOAuthState(state);
  if (!parsed || parsed.provider !== provider.id) return back("error");

  let session;
  try {
    session = await requirePermission("crm-email", ["admin"]);
  } catch {
    return fail(401, "Not authenticated");
  }
  if (session.id !== parsed.userId || (session.orgId as string) !== parsed.orgId) return back("error");
  if (!encryptionConfigured()) {
    return fail(503, "Email integration is not configured (missing encryption key).");
  }

  try {
    const tokens = await provider.exchangeCode(code, emailRedirectUri(origin, provider.id));
    const identity = await provider.getIdentity(tokens.accessToken);
    const id = await cx().mutation(api.crmEmail.upsertConnection, {
      secret: secret(),
      orgId: session.orgId as never,
      userId: session.id as never,
      provider: provider.id,
      email: identity.email ?? undefined,
      accessTokenEnc: encryptToken(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    });
    queueEmailSync(String(id));
    return back("connected");
  } catch (e) {
    try {
      return mapConvexError(e);
    } catch {
      return back("error");
    }
  }
}
