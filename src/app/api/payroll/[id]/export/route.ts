import { NextRequest, NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Export a payroll run for payment: ?format=csv|bank|mpesa */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "csv").toLowerCase();

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

    if (!["csv", "bank", "mpesa"].includes(format)) throw new HttpError(400, "Unknown export format");

    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const toIntl = (p: string | null | undefined) => {
      if (!p) return "";
      let d = p.replace(/\D/g, "");
      if (d.startsWith("0")) d = "254" + d.slice(1);
      else if (d.length === 9) d = "254" + d;
      return d;
    };
    const period = `${String(run.month).padStart(2, "0")}-${run.year}`;

    let rows: unknown[][];
    let filename: string;

    if (format === "bank") {
      rows = [
        ["Account Name", "Bank", "Account Number", "Amount", "Reference"],
        ...run.payslips.map((p) => [p.name, p.bankName ?? "", p.bankAccount ?? "", p.netPay.toFixed(2), `SAL-${period}`]),
      ];
      filename = `bank-payment-${period}.csv`;
    } else if (format === "mpesa") {
      rows = [
        ["MSISDN", "Amount", "Reference", "Remarks"],
        ...run.payslips
          .filter((p) => (p.mpesaNumber ?? p.phone))
          .map((p) => [toIntl(p.mpesaNumber ?? p.phone), p.netPay.toFixed(2), `SAL-${period}`, `${p.name} salary`]),
      ];
      filename = `mpesa-payment-${period}.csv`;
    } else {
      rows = [
        [
          "Name",
          "Type",
          "Employee No",
          "Basic",
          "Allowances",
          "Per diem",
          "Overtime",
          "Bonus",
          "Leave payout",
          "Gross",
          "NSSF",
          "SHIF",
          "Housing",
          "Pension",
          "PAYE",
          "HELB",
          "Loan",
          "Other deductions",
          "Total deductions",
          "Net pay",
        ],
        ...run.payslips.map((p) => [
          p.name,
          p.personType,
          p.employeeNumber ?? "",
          p.basicSalary.toFixed(2),
          p.allowances.toFixed(2),
          p.perDiem.toFixed(2),
          p.overtimePay.toFixed(2),
          p.bonus.toFixed(2),
          p.leaveDaysPayout.toFixed(2),
          p.grossPay.toFixed(2),
          p.nssf.toFixed(2),
          p.sha.toFixed(2),
          p.housingLevy.toFixed(2),
          p.pension.toFixed(2),
          p.paye.toFixed(2),
          p.helb.toFixed(2),
          p.loanRepayment.toFixed(2),
          p.otherDeductions.toFixed(2),
          p.totalDeductions.toFixed(2),
          p.netPay.toFixed(2),
        ]),
      ];
      filename = `payroll-${period}.csv`;
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
