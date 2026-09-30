import { NextRequest, NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { cx, secret, api } from "@/lib/convex";

/**
 * GET /api/admin/audit/export?orgId= - download one company's full audit trail
 * (including platform actions) as CSV. Super admin only.
 */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireUser(["super_admin"]);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    if (!orgId) throw new HttpError(400, "orgId is required");

    const data = (await cx().query(api.audit.adminList, {
      secret: secret(),
      superAdminId: session.id as never,
      orgId: orgId as never,
      limit: 1000,
    })) as { items: Array<Record<string, unknown>> };

    const header = ["createdAt", "actorName", "actorRole", "action", "module", "targetType", "targetId", "summary", "ip"];
    const rows = [header.join(",")];
    for (const r of data.items) {
      rows.push(
        header
          .map((h) => csvCell(h === "createdAt" ? new Date(r.createdAt as number).toISOString() : r[h]))
          .join(",")
      );
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse("\uFEFF" + rows.join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="company-audit-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
