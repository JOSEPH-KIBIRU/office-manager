import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requireUser();
    try {
      const data = await cx().query(api.notifications.listForUser, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
      });
      return ok(data);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Mark all notifications as read. */
export async function POST() {
  return handle(async () => {
    const session = await requireUser();
    try {
      const marked = await cx().mutation(api.notifications.markAllRead, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
      });
      return ok({ marked });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
