"use client";

import { useEffect, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import { PayslipLines, type PayslipDetail } from "@/components/payslip";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const fmt = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface MyPayslip {
  id: string;
  month: number;
  year: number;
  grossPay: number;
  netPay: number;
  created_at: string;
}

export default function MyPayslipsPage() {
  const [payslips, setPayslips] = useState<MyPayslip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MyPayslip | null>(null);
  const [detail, setDetail] = useState<PayslipDetail | null>(null);

  async function load() {
    try {
      const data = await api<{ payslips: MyPayslip[] }>("/api/payroll/my");
      setPayslips(data.payslips);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payslips");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function open(p: MyPayslip) {
    setSelected(p);
    setDetail(null);
    try {
      const d = await api<PayslipDetail>(`/api/payroll/payslip/${p.id}`);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payslip");
    }
  }

  return (
    <>
      <PageHeader
        title="My Payslips"
        subtitle="View your monthly salary statements. Open a payslip to print or save it as a PDF."
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Period</th>
              <th className="text-right">Gross pay</th>
              <th className="text-right">Net pay</th>
              <th>Generated</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payslips.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{MONTHS[p.month - 1]} {p.year}</td>
                <td className="text-right">{fmt(p.grossPay)}</td>
                <td className="text-right text-emerald-700">{fmt(p.netPay)}</td>
                <td className="text-slate-500">{p.created_at}</td>
                <td className="whitespace-nowrap text-right">
                  <button onClick={() => open(p)} className="btn-secondary px-3 py-1 text-xs">View</button>
                </td>
              </tr>
            ))}
            {payslips.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-500">No payslips have been generated for you yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && detail && (
        <div className="card mt-6 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-600">
              Payslip — {MONTHS[detail.month - 1]} {detail.year}
            </h2>
            <button
              onClick={() => window.open(`/payslip/${selected.id}`, "_blank")}
              className="btn-primary px-3 py-1 text-xs"
            >
              Download / print as PDF
            </button>
          </div>
          <div className="p-5">
            <p className="mb-2 text-xs text-slate-500">
              Employee: {detail.name} · Emp No: {detail.employeeNumber ?? "—"} · Pay period: {MONTHS[detail.month - 1]} {detail.year}
            </p>
            <PayslipLines data={detail} />
          </div>
        </div>
      )}
    </>
  );
}
