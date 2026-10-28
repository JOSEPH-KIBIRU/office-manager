import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const ROLES = ["admin", "secretary", "manager", "employee"];

/** Start (or reopen) a direct conversation with a colleague. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("chat", ROLES);
    const body = await readJson<{ userId?: string }>(req);
    if (!body.userId) throw new HttpError(400, "userId is required");
    try {
      const id = await cx().mutation(api.chat.ensureDirectChannel, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        otherUserId: body.userId as never,
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
