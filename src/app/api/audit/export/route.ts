import { NextRequest, NextResponse } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { cx, secret, api } from "@/lib/convex";

/**
 * GET /api/audit/export - download the audit trail as CSV (admin only).
 */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  try {
    const session = await requirePermission("audit-log", ["admin"]);
    const data = (await cx().query(api.audit.list, {
      secret: secret(),
      orgId: session.orgId as never,
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
        "Content-Disposition": `attachment; filename="audit-log-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
