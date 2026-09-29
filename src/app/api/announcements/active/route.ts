import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    await requireUser();
    let announcements;
    try {
      announcements = await cx().query(api.superadmin.listActiveAnnouncements, {
        secret: secret(),
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok({ announcements });
  });
}
