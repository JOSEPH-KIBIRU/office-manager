import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Delete a public holiday. Admin or secretary. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin", "secretary"]);
    const { id } = await ctx.params;
    try {
      const res = await cx().mutation(api.holidays.deleteHoliday, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
