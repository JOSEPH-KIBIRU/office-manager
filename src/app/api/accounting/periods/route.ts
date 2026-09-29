import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Lock or unlock an accounting period. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary"]);
    const body = await readJson<{ period: string; action: "lock" | "unlock" }>(req);
    requireFields(body, ["period", "action"]);
    if (body.action !== "lock" && body.action !== "unlock") throw new HttpError(400, "Invalid action");
    try {
      if (body.action === "lock") {
        await cx().mutation(api.accounting.lockPeriod, {
          secret: secret(),
          orgId: session.orgId as never,
          period: String(body.period),
          lockedBy: session.id as never,
        });
      } else {
        await cx().mutation(api.accounting.unlockPeriod, {
          secret: secret(),
          orgId: session.orgId as never,
          period: String(body.period),
        });
      }
      return ok();
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
