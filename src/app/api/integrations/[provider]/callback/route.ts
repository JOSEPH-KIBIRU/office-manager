import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { getProvider } from "@/lib/calendar/providers";
import { encryptToken, encryptionConfigured } from "@/lib/calendar/crypto";
import { verifyOAuthState } from "@/lib/calendar/state";
import { requestOrigin, calendarRedirectUri } from "@/lib/calendar/urls";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await ctx.params;
  const provider = getProvider(providerId);
  if (!provider) return fail(404, "Unknown calendar provider");

  const origin = await requestOrigin();
  const back = (status: string) => NextResponse.redirect(`${origin}/profile?calendar=${status}&provider=${providerId}`);

  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back("error");

  const parsed = await verifyOAuthState(state);
  if (!parsed || parsed.provider !== provider.id) return back("error");

  let session;
  try {
    session = await requireUser();
  } catch {
    return fail(401, "Not authenticated");
  }
  if (session.id !== parsed.userId || (session.orgId as string) !== parsed.orgId) return back("error");
  if (!encryptionConfigured()) return fail(503, "Calendar integration is not configured (missing encryption key).");

  try {
    const tokens = await provider.exchangeCode(code, calendarRedirectUri(origin, provider.id));
    const email = await provider.getEmail(tokens.accessToken);
    await cx().mutation(api.calendar.upsertConnection, {
      secret: secret(),
      orgId: session.orgId as never,
      userId: session.id as never,
      provider: provider.id,
      email: email ?? undefined,
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    });
    return back("connected");
  } catch (e) {
    try {
      return mapConvexError(e);
    } catch {
      return back("error");
    }
  }
}
