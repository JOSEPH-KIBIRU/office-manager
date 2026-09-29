import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{ active?: boolean; archived?: boolean }>(req);

    if (body.archived === undefined && body.active === undefined) {
      throw new HttpError(400, "Provide `active` or `archived`");
    }
    if (body.active !== undefined && typeof body.active !== "boolean") {
      throw new HttpError(400, "active must be a boolean");
    }
    if (body.archived !== undefined && typeof body.archived !== "boolean") {
      throw new HttpError(400, "archived must be a boolean");
    }

    try {
      if (body.archived !== undefined) {
        const result = body.archived
          ? await cx().mutation(api.superadmin.softDeleteCompany, {
              secret: secret(),
              superAdminId: session.id as never,
              orgId: id as never,
            })
          : await cx().mutation(api.superadmin.restoreCompany, {
              secret: secret(),
              superAdminId: session.id as never,
              orgId: id as never,
            });
        await recordAudit(
          session,
          { action: body.archived ? "company.archive" : "company.restore", module: "platform", summary: `${body.archived ? "Archived" : "Restored"} company` },
          null,
          id
        );
        return ok(result);
      }

      const result = await cx().mutation(api.superadmin.setCompanyActive, {
        secret: secret(),
        superAdminId: session.id as never,
        orgId: id as never,
        active: body.active as boolean,
      });
      await recordAudit(
        session,
        { action: body.active ? "company.reactivate" : "company.suspend", module: "platform", summary: `${body.active ? "Reactivated" : "Suspended"} company` },
        null,
        id
      );
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/**
 * Permanently delete a company and all of its data. A safety snapshot is taken
 * first (unless ?snapshot=0), then rows are purged in bounded batches.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    const wantSnapshot = new URL(req.url).searchParams.get("snapshot") !== "0";

    let snapshotId: string | null = null;
    if (wantSnapshot) {
      try {
        const snap = await cx().action(api.backup.createSnapshot, {
          secret: secret(),
          superAdminId: session.id as never,
          orgId: id as never,
          kind: "pre_delete",
        });
        snapshotId = snap.id;
      } catch (e) {
        return mapConvexError(e);
      }
    }

    let deleted = 0;
    let guard = 0;
    try {
      for (;;) {
        const res = await cx().mutation(api.superadmin.purgeCompanyBatch, {
          secret: secret(),
          superAdminId: session.id as never,
          orgId: id as never,
          limit: 150,
        });
        deleted += res.deleted;
        if (res.done) break;
        if (++guard > 1000) throw new HttpError(500, "Purge did not complete in a reasonable number of steps");
      }
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return mapConvexError(e);
    }

    await recordAudit(
      session,
      { action: "company.delete", module: "platform", summary: `Permanently deleted company (${deleted} records)` },
      null,
      id
    );

    return ok({ deleted: true, rows: deleted, snapshotId });
  });
}
