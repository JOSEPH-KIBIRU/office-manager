import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/**
 * POST /api/admin/companies/[id]/restore  { snapshotId }
 * Restores a company from a stored snapshot (in-place rebuild).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { snapshotId?: string };
    if (!body.snapshotId) throw new HttpError(400, "snapshotId is required");

    try {
      const result = await cx().action(api.restore.restoreSnapshot, {
        secret: secret(),
        superAdminId: session.id as never,
        orgId: id as never,
        snapshotId: body.snapshotId as never,
      });
      await recordAudit(
        session,
        {
          action: "backup.restore",
          module: "platform",
          summary: `Restored company from snapshot (${result.restored} records rebuilt)`,
        },
        null,
        id
      );
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
