import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { setSessionCookie } from "@/lib/auth";
import { TERMS_VERSION } from "@/lib/terms";

export async function POST() {
  return handle(async () => {
    const session = await requireUser();
    if (session.role === "super_admin") return ok({ termsAgreedAt: true, termsVersion: TERMS_VERSION });

    try {
      await cx().mutation(api.users.setTermsAccepted, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
        version: TERMS_VERSION,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    await setSessionCookie({ ...session, termsAgreedAt: true, termsVersion: TERMS_VERSION });
    return ok({ termsAgreedAt: true, termsVersion: TERMS_VERSION });
  });
}