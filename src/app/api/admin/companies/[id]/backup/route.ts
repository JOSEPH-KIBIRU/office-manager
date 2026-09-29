import { NextRequest, NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "company"
  );
}

/** Download a full JSON export of the company (generated on the fly). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    const data = (await cx().query(api.backup.exportCompanyJson, {
      secret: secret(),
      superAdminId: session.id as never,
      orgId: id as never,
    })) as { meta?: { orgName?: string | null } };

    const name = data?.meta?.orgName ?? "company";
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug(name)}-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}

/** Create a stored point-in-time snapshot. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    try {
      const result = await cx().action(api.backup.createSnapshot, {
        secret: secret(),
        superAdminId: session.id as never,
        orgId: id as never,
        kind: "manual",
      });
      await recordAudit(session, { action: "backup.create", module: "platform", summary: "Created backup snapshot" }, null, id);
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
