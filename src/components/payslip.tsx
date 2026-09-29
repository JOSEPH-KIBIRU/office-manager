"use client";

export interface PayslipDetail {
  id: string;
  month: number;
  year: number;
  name: string;
  employeeNumber: string | null;
  role: string;
  employmentType?: string;
  personType?: string;
  basicSalary: number;
  allowances: number;
  perDiem?: number;
  overtimePay?: number;
  bonus?: number;
  leaveDaysPayout: number;
  daysWorked?: number | null;
  dailyRate?: number | null;
  statutory?: boolean;
  grossPay: number;
  nssf: number;
  sha: number;
  housingLevy: number;
  pension?: number;
  taxablePay: number;
  incomeTax: number;
  personalRelief: number;
  paye: number;
  helb: number;
  loanRepayment?: number;
  otherDeductions?: number;
  totalDeductions: number;
  netPay: number;
}

const fmtKsh = (n: number) =>
  "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Shared line-item payslip layout matching the Kenyan reference format. */
export function PayslipLines({ data }: { data: PayslipDetail }) {
  const isCasual = data.personType === "casual";
  const perDiem = data.perDiem ?? 0;
  const basicLabel = isCasual
    ? `CASUAL WAGES${data.daysWorked != null ? ` (${data.daysWorked} day(s) × ${fmtKsh(data.dailyRate ?? 0)})` : ""}`
    : "BASIC PAY";
  const hasStatutory = data.nssf > 0 || data.sha > 0 || data.housingLevy > 0 || data.paye > 0;

  return (
    <div className="mx-auto max-w-md">
      <table className="w-full border-collapse text-center text-sm">
        <tbody>
          <tr className="border border-slate-300"><td className="p-2 font-semibold">{basicLabel}</td><td className="p-2 text-center">{fmtKsh(data.basicSalary)}</td></tr>
          {data.allowances > 0 && <tr className="border border-slate-300"><td className="p-2">Allowances</td><td className="p-2 text-center">{fmtKsh(data.allowances)}</td></tr>}
          {(data.overtimePay ?? 0) > 0 && <tr className="border border-slate-300"><td className="p-2">Overtime</td><td className="p-2 text-center">{fmtKsh(data.overtimePay ?? 0)}</td></tr>}
          {(data.bonus ?? 0) > 0 && <tr className="border border-slate-300"><td className="p-2">Bonus</td><td className="p-2 text-center">{fmtKsh(data.bonus ?? 0)}</td></tr>}
          {perDiem > 0 && <tr className="border border-slate-300"><td className="p-2">Per Diem (non-taxable)</td><td className="p-2 text-center">{fmtKsh(perDiem)}</td></tr>}
          {data.leaveDaysPayout > 0 && <tr className="border border-slate-300"><td className="p-2">Leave Days Payout</td><td className="p-2 text-center">{fmtKsh(data.leaveDaysPayout)}</td></tr>}
          <tr className="border border-slate-300 bg-slate-50"><td className="p-2 font-semibold">GROSS PAY</td><td className="p-2 text-center font-semibold">{fmtKsh(data.grossPay)}</td></tr>
          {hasStatutory && (
            <>
              <tr className="border border-slate-300"><td className="p-2">NSSF</td><td className="p-2 text-center">{fmtKsh(data.nssf)}</td></tr>
              <tr className="border border-slate-300"><td className="p-2">SHIF (Social Health Insurance)</td><td className="p-2 text-center">{fmtKsh(data.sha)}</td></tr>
              <tr className="border border-slate-300"><td className="p-2">Housing Levy</td><td className="p-2 text-center">{fmtKsh(data.housingLevy)}</td></tr>
              {data.pension && data.pension > 0 ? <tr className="border border-slate-300"><td className="p-2">Pension Contribution</td><td className="p-2 text-center">{fmtKsh(data.pension)}</td></tr> : null}
              <tr className="border-2 border-slate-500 bg-slate-50 font-bold"><td className="p-2">TAXABLE PAY</td><td className="p-2 text-center">{fmtKsh(data.taxablePay)}</td></tr>
              <tr className="border border-slate-300"><td className="p-2">INCOME TAX</td><td className="p-2 text-center">{fmtKsh(data.incomeTax)}</td></tr>
              <tr className="border border-slate-300"><td className="p-2">Personal Relief</td><td className="p-2 text-center text-emerald-700">−{fmtKsh(data.personalRelief)}</td></tr>
              <tr className="border-2 border-slate-500 bg-red-50 font-bold text-red-700"><td className="p-2">P.A.Y.E</td><td className="p-2 text-center">{fmtKsh(data.paye)}</td></tr>
              {data.helb > 0 && <tr className="border border-slate-300"><td className="p-2">HELB Loan Repayment</td><td className="p-2 text-center">{fmtKsh(data.helb)}</td></tr>}
            </>
          )}
          {(data.loanRepayment ?? 0) > 0 && <tr className="border border-slate-300"><td className="p-2">Staff Loan / Advance</td><td className="p-2 text-center">{fmtKsh(data.loanRepayment ?? 0)}</td></tr>}
          {(data.otherDeductions ?? 0) > 0 && <tr className="border border-slate-300"><td className="p-2">Other Deductions</td><td className="p-2 text-center">{fmtKsh(data.otherDeductions ?? 0)}</td></tr>}
          <tr className="border border-slate-300"><td className="p-2">Total Deductions</td><td className="p-2 text-center">{fmtKsh(data.totalDeductions)}</td></tr>
          <tr className="border-2 border-slate-500 bg-emerald-50 text-base font-bold text-emerald-800"><td className="p-2">NET PAY</td><td className="p-2 text-center">{fmtKsh(data.netPay)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
