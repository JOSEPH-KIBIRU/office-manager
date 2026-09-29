import { NextRequest, NextResponse } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Statutory return exports: ?type=p10|nssf|shif|housing */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("reports", ["admin", "secretary"]);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "p10").toLowerCase();

    let run;
    try {
      run = await cx().query(api.payroll.payrollRunDetail, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const period = `${String(run.month).padStart(2, "0")}-${run.year}`;
    const employees = run.payslips.filter((p) => p.personType === "employee");
    const pensionable = (p: (typeof run.payslips)[number]) => p.grossPay - p.perDiem;

    let rows: unknown[][];
    let filename: string;

    if (type === "nssf") {
      rows = [
        ["Member No", "Name", "Pensionable Pay", "Tier I", "Tier II", "Employee Total", "Employer Total"],
        ...employees.map((p) => [
          p.statutoryNumber ?? "",
          p.name,
          pensionable(p).toFixed(2),
          p.nssfTier1.toFixed(2),
          p.nssfTier2.toFixed(2),
          p.nssf.toFixed(2),
          p.nssf.toFixed(2),
        ]),
      ];
      filename = `nssf-return-${period}.csv`;
    } else if (type === "shif") {
      rows = [
        ["Member No", "Name", "Gross Pay", "SHIF Contribution"],
        ...employees.map((p) => [p.statutoryNumber ?? "", p.name, pensionable(p).toFixed(2), p.sha.toFixed(2)]),
      ];
      filename = `shif-return-${period}.csv`;
    } else if (type === "housing") {
      rows = [
        ["Name", "Gross Pay", "Employee Levy", "Employer Levy"],
        ...employees.map((p) => [
          p.name,
          pensionable(p).toFixed(2),
          p.housingLevy.toFixed(2),
          (pensionable(p) * 0.015).toFixed(2),
        ]),
      ];
      filename = `housing-levy-return-${period}.csv`;
    } else if (type === "p10") {
      rows = [
        ["PIN / Member No", "Name", "Gross Pay", "Taxable Pay", "PAYE"],
        ...employees.map((p) => [
          p.statutoryNumber ?? "",
          p.name,
          p.grossPay.toFixed(2),
          p.taxablePay.toFixed(2),
          p.paye.toFixed(2),
        ]),
      ];
      filename = `p10-return-${period}.csv`;
    } else {
      throw new HttpError(400, "Unknown return type");
    }

    const csv = "\ufeff" + toCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}
