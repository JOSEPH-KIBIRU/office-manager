"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, api } from "@/components/ui";
import { PayslipLines, type PayslipDetail } from "@/components/payslip";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function PayslipView({ payrollId, userId }: { payrollId: string; userId?: string }) {
  const [data, setData] = useState<PayslipDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<PayslipDetail>(
      `/api/payroll/payslip/${payrollId}${userId ? `?userId=${userId}` : ""}`
    )
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [payrollId, userId]);

  return (
    <div className="payslip-print mx-auto max-w-2xl p-6">
      <div className="mb-4 text-center">
        <h1 className="text-xl font-bold text-slate-900">Office Manager — Payroll</h1>
        <p className="text-sm text-slate-600">Payslip for {MONTHS[(data?.month ?? 1) - 1]} {(data?.year) ?? ""}</p>
      </div>
      {err && <Alert kind="error">{err}</Alert>}
      {!data && !err && <p className="text-sm text-slate-500">Loading payslip… (printing will open momentarily)</p>}
      {data && (
        <>
          <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-slate-500">Employee name</p>
                <p className="font-semibold">{data.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Employee number</p>
                <p className="font-semibold">{data.employeeNumber ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Role</p>
                <p className="capitalize">{data.role}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pay period</p>
                <p className="font-semibold">{MONTHS[data.month - 1]} {data.year}</p>
              </div>
            </div>
          </div>

          <PayslipLines data={data} />

          <p className="mt-6 text-center text-xs text-slate-400">
            This is a computer-generated payslip. Generated {new Date().toLocaleDateString("en-KE")}.
          </p>
        </>
      )}
    </div>
  );
}

function Inner({ payrollId }: { payrollId: string }) {
  const params = useSearchParams();
  const userId = params.get("userId") ?? undefined;
  useEffect(() => {
    // Allow the payslip to mount, then trigger the browser print dialog
    // ("Save as PDF" destination) for a true PDF download.
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return <PayslipView payrollId={payrollId} userId={userId} />;
}

export default function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const [payrollId, setPayrollId] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve(params).then((p) => setPayrollId(p.id));
  }, [params]);
  if (!payrollId) return null;
  return (
    <Suspense fallback={null}>
      <Inner payrollId={payrollId} />
    </Suspense>
  );
}
