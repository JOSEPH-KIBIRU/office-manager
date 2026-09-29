import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requireUser();
    try {
      const data = await cx().query(api.analytics.series, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        isAdmin: session.role === "admin",
      });
      return ok(data);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
