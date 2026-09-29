import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Post journals for documents created before auto-posting existed. */
export async function POST() {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    try {
      const result = await cx().mutation(api.accounting.backfill, {
        secret: secret(),
        orgId: session.orgId as never,
        postedByName: session.name,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
