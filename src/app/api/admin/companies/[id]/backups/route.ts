import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** List stored snapshots for a company. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    try {
      const snapshots = await cx().query(api.backup.listSnapshots, {
        secret: secret(),
        superAdminId: session.id as never,
        orgId: id as never,
      });
      return ok({ snapshots });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Delete a stored snapshot: /api/admin/companies/[id]/backups?snapshotId=... */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    const snapshotId = new URL(req.url).searchParams.get("snapshotId");
    if (!snapshotId) throw new HttpError(400, "snapshotId is required");
    try {
      const result = await cx().mutation(api.backup.deleteSnapshot, {
        secret: secret(),
        superAdminId: session.id as never,
        id: snapshotId as never,
      });
      await recordAudit(session, { action: "backup.delete", module: "platform", summary: "Deleted backup snapshot" }, null, id);
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
