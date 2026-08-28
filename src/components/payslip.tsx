"use client";

export interface PayslipDetail {
  id: string;
  month: number;
  year: number;
  name: string;
  employeeNumber: string | null;
  role: string;
  basicSalary: number;
  allowances: number;
  leaveDaysPayout: number;
  grossPay: number;
  nssf: number;
  sha: number;
  housingLevy: number;
  taxablePay: number;
  incomeTax: number;
  personalRelief: number;
  paye: number;
  helb: number;
  totalDeductions: number;
  netPay: number;
}

const fmtKsh = (n: number) =>
  "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Shared line-item payslip layout matching the Kenyan reference format. */
export function PayslipLines({ data }: { data: PayslipDetail }) {
  return (
    <div className="max-w-md">
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr className="border border-slate-300"><td className="p-2 font-semibold">BASIC PAY</td><td className="p-2 text-right">{fmtKsh(data.basicSalary)}</td></tr>
          {data.allowances > 0 && <tr className="border border-slate-300"><td className="p-2">Allowances</td><td className="p-2 text-right">{fmtKsh(data.allowances)}</td></tr>}
          {data.leaveDaysPayout > 0 && <tr className="border border-slate-300"><td className="p-2">Leave Days Payout</td><td className="p-2 text-right">{fmtKsh(data.leaveDaysPayout)}</td></tr>}
          <tr className="border border-slate-300"><td className="p-2">NSSF</td><td className="p-2 text-right">{fmtKsh(data.nssf)}</td></tr>
          <tr className="border border-slate-300"><td className="p-2">SHIF (Social Health Insurance)</td><td className="p-2 text-right">{fmtKsh(data.sha)}</td></tr>
          <tr className="border border-slate-300"><td className="p-2">Housing Levy</td><td className="p-2 text-right">{fmtKsh(data.housingLevy)}</td></tr>
          <tr className="border-2 border-slate-500 bg-slate-50 font-bold"><td className="p-2">TAXABLE PAY</td><td className="p-2 text-right">{fmtKsh(data.taxablePay)}</td></tr>
          <tr className="border border-slate-300"><td className="p-2">INCOME TAX</td><td className="p-2 text-right">{fmtKsh(data.incomeTax)}</td></tr>
          <tr className="border border-slate-300"><td className="p-2">Personal Relief</td><td className="p-2 text-right text-emerald-700">−{fmtKsh(data.personalRelief)}</td></tr>
          <tr className="border-2 border-slate-500 bg-red-50 font-bold text-red-700"><td className="p-2">P.A.Y.E</td><td className="p-2 text-right">{fmtKsh(data.paye)}</td></tr>
          {data.helb > 0 && <tr className="border border-slate-300"><td className="p-2">HELB Loan Repayment</td><td className="p-2 text-right">{fmtKsh(data.helb)}</td></tr>}
          <tr className="border-2 border-slate-500 bg-emerald-50 text-base font-bold text-emerald-800"><td className="p-2">NET PAY</td><td className="p-2 text-right">{fmtKsh(data.netPay)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
