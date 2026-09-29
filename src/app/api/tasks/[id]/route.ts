import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Task detail + report/comment thread. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser();
    const { id } = await ctx.params;
    try {
      const data = await cx().query(api.tasks.getTask, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        viewerId: session.id as never,
      });
      if (!data) throw new HttpError(404, "Task not found");
      return ok(data);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
