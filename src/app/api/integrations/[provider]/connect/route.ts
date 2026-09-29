import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/api";
import { getProvider } from "@/lib/calendar/providers";
import { encryptionConfigured } from "@/lib/calendar/crypto";
import { signOAuthState } from "@/lib/calendar/state";
import { requestOrigin, calendarRedirectUri } from "@/lib/calendar/urls";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await ctx.params;
  const provider = getProvider(providerId);
  if (!provider) return fail(404, "Unknown calendar provider");
  if (!provider.configured) return fail(503, `${provider.label} is not configured yet.`);
  if (!encryptionConfigured()) return fail(503, "Calendar integration is not configured (missing encryption key).");

  let session;
  try {
    session = await requireUser();
  } catch {
    return fail(401, "Not authenticated");
  }

  const origin = await requestOrigin();
  const state = await signOAuthState({ userId: session.id, orgId: session.orgId as string, provider: provider.id });
  const url = provider.authUrl(calendarRedirectUri(origin, provider.id), state);
  return NextResponse.redirect(url);
}
