import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { PROVIDERS } from "@/lib/calendar/providers";

/** List the current user's calendar connections + which providers are configured. */
export async function GET() {
  return handle(async () => {
    const session = await requireUser();
    let connections;
    try {
      connections = await cx().query(api.calendar.listMyConnections, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok({
      connections,
      providers: [
        { id: "google", label: PROVIDERS.google.label, configured: PROVIDERS.google.configured },
        { id: "microsoft", label: PROVIDERS.microsoft.label, configured: PROVIDERS.microsoft.configured },
      ],
    });
  });
}
