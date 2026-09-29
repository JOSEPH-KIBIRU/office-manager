import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { generateTotpSecret, totpUri } from "@/lib/totp";

/** Start 2FA setup: generate a secret and return the QR to scan. */
export async function POST() {
  return handle(async () => {
    const session = await requireUser();
    const value = generateTotpSecret();

    let issuer = "Office Manager";
    try {
      const org = await cx().query(api.organizations.getOrganization, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      issuer = org.name || issuer;
    } catch {
      /* keep default issuer */
    }

    const uri = totpUri(value, session.email, issuer);
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });

    try {
      await cx().mutation(api.twofa.setPendingSecret, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
        twoFactorSecret: value,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    return ok({ secret: value, otpauthUrl: uri, qr });
  });
}
