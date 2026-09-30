"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, api } from "@/components/ui";
import { PayslipLines, type PayslipDetail } from "@/components/payslip";
import { OrgHeader, type OrgBrandingData } from "@/components/OrgBranding";
import { printDocument } from "@/lib/print";
import ShareButton from "@/components/ShareButton";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://officemanager.pigiecore.co.ke";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface PayslipViewData extends PayslipDetail {
  org?: OrgBrandingData | null;
}

function PayslipView({ payrollId, userId, casualId }: { payrollId: string; userId?: string; casualId?: string }) {
  const [data, setData] = useState<PayslipViewData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const printed = useRef(false);

  useEffect(() => {
    const qs = casualId ? `?casualId=${casualId}` : userId ? `?userId=${userId}` : "";
    api<PayslipViewData>(`/api/payroll/payslip/${payrollId}${qs}`)
      .then((d) => {
        setData(d);
        // Print once the payslip has actually rendered (avoids a blank page).
        if (!printed.current) {
          printed.current = true;
          setTimeout(() => printDocument("/my-payslips"), 400);
        }
      })
      .catch((e) => setErr(e.message));
  }, [payrollId, userId, casualId]);

  return (
    <div className="payslip-print mx-auto flex min-h-[calc(100vh-2rem)] max-w-3xl flex-col p-4 sm:p-6 print:max-w-none print:border-0">
      <OrgHeader
        org={data?.org ?? null}
        showTax
        periodLabel={`Payslip for ${MONTHS[(data?.month ?? 1) - 1]} ${data?.year ?? ""}`}
      />
      {err && <Alert kind="error">{err}</Alert>}
      {!data && !err && <p className="text-sm text-slate-500">Loading payslip… (printing will open momentarily)</p>}
      {data && (
        <>
          <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
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
                <p className="text-xs text-slate-500">Employment type</p>
                <p className="font-semibold">
                  {data.employmentType === "permanent_pensionable"
                    ? "Permanent & Pensionable"
                    : data.employmentType === "casual"
                      ? "Casual"
                      : "Permanent"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pay period</p>
                <p className="font-semibold">{MONTHS[data.month - 1]} {data.year}</p>
              </div>
            </div>
          </div>

          <PayslipLines data={data} />

          <footer className="mt-auto border-t border-slate-200 pt-3 text-center text-[11px] leading-relaxed text-slate-500">
            <p>This is a computer-generated payslip.</p>
            <p>
              Powered by{" "}
              <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 hover:underline">
                Office Manager
              </a>
            </p>
          </footer>
        </>
      )}
    </div>
  );
}

function Inner({ payrollId }: { payrollId: string }) {
  const params = useSearchParams();
  const userId = params.get("userId") ?? undefined;
  const casualId = params.get("casualId") ?? undefined;
  return <PayslipView payrollId={payrollId} userId={userId} casualId={casualId} />;
}

export default function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const [payrollId, setPayrollId] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve(params).then((p) => setPayrollId(p.id));
  }, [params]);
  if (!payrollId) return null;
  return (
    <Suspense fallback={null}>
      <div className="no-print fixed right-4 top-4 z-50 flex gap-2">
        <button onClick={() => printDocument("/my-payslips")} className="btn-primary px-3 py-1.5 text-sm">⬇ Download PDF</button>
        <ShareButton label="Share" className="btn-secondary px-3 py-1.5 text-sm" />
      </div>
      <Inner payrollId={payrollId} />
    </Suspense>
  );
}
