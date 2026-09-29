import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { getProvider } from "@/lib/calendar/providers";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  return handle(async () => {
    const { provider: providerId } = await ctx.params;
    const provider = getProvider(providerId);
    if (!provider) return mapConvexError(new Error("Unknown calendar provider"));
    const session = await requireUser();
    try {
      await cx().mutation(api.calendar.disconnect, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
        provider: provider.id,
      });
      return ok();
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
