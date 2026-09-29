import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const STATUSES = ["new", "contacted", "closed"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{ status: string }>(req);
    if (!body.status || !STATUSES.includes(body.status)) {
      throw new HttpError(400, "Invalid status");
    }
    try {
      const result = await cx().mutation(api.enquiries.updateEnquiryStatus, {
        secret: secret(),
        superAdminId: session.id as never,
        id: id as never,
        status: body.status as "new" | "contacted" | "closed",
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    try {
      const result = await cx().mutation(api.enquiries.deleteEnquiry, {
        secret: secret(),
        superAdminId: session.id as never,
        id: id as never,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
