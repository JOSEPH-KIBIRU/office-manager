import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requireUser();
    try {
      const status = await cx().query(api.twofa.status, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
      });
      return ok(status);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
