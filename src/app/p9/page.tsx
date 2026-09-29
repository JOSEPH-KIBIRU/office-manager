"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { Alert, api } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import { OrgHeader, OrgFooter, type OrgBrandingData } from "@/components/OrgBranding";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface P9Month {
  month: number;
  basicSalary: number;
  allowances: number;
  leaveDaysPayout: number;
  grossPay: number;
  nssf: number;
  sha: number;
  housingLevy: number;
  pension: number;
  taxablePay: number;
  incomeTax: number;
  personalRelief: number;
  paye: number;
  helb: number;
  totalDeductions: number;
  netPay: number;
}

interface P9Data {
  year: number;
  org_name: string;
  org: OrgBrandingData | null;
  employee: {
    id: string;
    name: string;
    employee_number: string | null;
    role: string;
    employment_type: string;
    statutory_number: string | null;
  };
  months: P9Month[];
  totals: {
    basic_salary: number;
    allowances: number;
    leave_days_payout: number;
    gross_pay: number;
    nssf: number;
    sha: number;
    housing_levy: number;
    pension: number;
    taxable_pay: number;
    income_tax: number;
    personal_relief: number;
    paye: number;
    helb: number;
    total_deductions: number;
    net_pay: number;
  };
}

function fmt(n: number) {
  return "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function P9View({ year, userId }: { year: string; userId?: string }) {
  const [data, setData] = useState<P9Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const printed = useRef(false);

  useEffect(() => {
    api<P9Data>(`/api/payroll/p9?year=${year}${userId ? `&userId=${userId}` : ""}`)
      .then((d) => {
        setData(d);
        // Print once the P9 has actually rendered (avoids a blank page).
        if (!printed.current) {
          printed.current = true;
          setTimeout(() => window.print(), 400);
        }
      })
      .catch((e) => setErr(e.message));
  }, [year, userId]);

  return (
    <div className="p9-print mx-auto max-w-4xl p-6 print:max-w-none print:p-0">
      <OrgHeader
        org={data?.org ?? null}
        showTax
        periodLabel={`Year of income: ${year}`}
      />
      {data?.employee && (
        <p className="mb-2 -mt-2 text-center text-sm font-semibold text-slate-700">
          P9 Annual Tax Deduction Card — {data.employee.name}
        </p>
      )}

      {err && <Alert kind="error">{err}</Alert>}
      {!data && !err && <p className="text-sm text-slate-500">Loading P9… (printing will open momentarily)</p>}

      {data && (
        <>
          <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <p><span className="text-slate-500">Employer: </span><span className="font-semibold">{data.org_name}</span></p>
              <p><span className="text-slate-500">Employee PIN (KRA): </span><span className="font-semibold">{data.employee.statutory_number ?? "—"}</span></p>
              <p><span className="text-slate-500">Employee number: </span><span className="font-semibold">{data.employee.employee_number ?? "—"}</span></p>
              <p><span className="text-slate-500">Role: </span><span className="capitalize">{data.employee.role}</span></p>
              <p><span className="text-slate-500">Employment type: </span><span className="font-semibold">
                {data.employee.employment_type === "permanent_pensionable" ? "Permanent & Pensionable" : "Permanent"}
              </span></p>
            </div>
          </div>

          {data.months.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No payroll records for {year}. Run payroll for that year first.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1.5 text-left">Month</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Basic pay</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Total gross</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">NSSF</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">SHIF</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Housing levy</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Pension</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Taxable pay</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Income tax</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Personal relief</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">PAYE</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Net pay</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month}>
                    <td className="border border-slate-300 px-2 py-1.5">{MONTHS[m.month - 1]}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(m.basicSalary)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(m.grossPay)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(m.nssf)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(m.sha)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(m.housingLevy)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(m.pension)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(m.taxablePay)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(m.incomeTax)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">−{fmt(m.personalRelief)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(m.paye)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(m.netPay)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold">
                  <td className="border border-slate-300 px-2 py-1.5">TOTALS</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(data.totals.basic_salary)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(data.totals.gross_pay)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(data.totals.nssf)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(data.totals.sha)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(data.totals.housing_levy)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(data.totals.pension)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(data.totals.taxable_pay)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(data.totals.income_tax)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">−{fmt(data.totals.personal_relief)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(data.totals.paye)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right">{fmt(data.totals.net_pay)}</td>
                </tr>
              </tbody>
            </table>
          )}

          <p className="mt-6 text-xs text-slate-500">
            Total statutory deductions for {data.year}: NSSF {fmt(data.totals.nssf)} · SHIF {fmt(data.totals.sha)} · Housing levy {fmt(data.totals.housing_levy)} · PAYE {fmt(data.totals.paye)}
            {data.totals.pension > 0 ? ` · Pension ${fmt(data.totals.pension)}` : ""}
            {data.totals.helb > 0 ? ` · HELB ${fmt(data.totals.helb)}` : ""}.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-10 text-sm text-slate-700">
            <div>
              <p className="mb-1 font-semibold">Employer / Officer responsible</p>
              <div className="mt-14 border-t border-slate-400">Signature</div>
              <div className="mt-8 border-t border-slate-400">Designation &amp; Date</div>
            </div>
            <div>
              <p className="mb-1 font-semibold">Employee</p>
              <div className="mt-14 border-t border-slate-400">Signature</div>
              <div className="mt-8 border-t border-slate-400">Date</div>
            </div>
          </div>

          <OrgFooter org={data.org ?? null} text="This is a computer-generated P9." />
        </>
      )}
    </div>
  );
}

function Inner({ year: initialYear, userId }: { year: string; userId?: string }) {
  const [year, setYear] = useState(initialYear);
  const now = new Date().getFullYear();
  const years = Array.from({ length: now - 2000 + 1 }, (_, i) => now - i);
  return (
    <>
      {/* P9 has 12 columns — print it landscape so nothing is truncated. */}
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <div className="no-print mx-auto mt-6 flex max-w-3xl items-center gap-2 px-6">
        <label className="text-sm font-medium text-slate-700">Year</label>
        <select
          className="input w-32"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <button
          className="btn-primary px-3 py-1.5 text-xs"
          onClick={() => window.print()}
        >
          🖨 Print / Save as PDF
        </button>
      </div>
      <P9View year={year} userId={userId} />
      <PrintButton />
    </>
  );
}

export default function P9Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [uid, setUid] = useState<string | undefined>(undefined);
  const [year, setYear] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve(searchParams).then((p) => {
      const y = typeof p.year === "string" ? p.year : "";
      const u = typeof p.userId === "string" ? p.userId : undefined;
      setYear(/\d{4}/.test(y) ? y : String(new Date().getFullYear()));
      setUid(u);
    });
  }, [searchParams]);
  if (year === null) return null;
  return (
    <Suspense fallback={null}>
      <Inner year={year} userId={uid} />
    </Suspense>
  );
}