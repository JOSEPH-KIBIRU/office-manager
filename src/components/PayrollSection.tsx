/**
 * Kenya payroll section — the product's strongest differentiator.
 */
const STATUTORY = [
  { label: "PAYE", note: "Pay As You Earn on correct KRA bands" },
  { label: "NSSF", note: "National Social Security Fund" },
  { label: "SHIF", note: "Social Health Insurance Fund" },
  { label: "Housing Levy", note: "Affordable Housing Levy (1.5%)" },
  { label: "HELB", note: "Higher Education Loans Board where applicable" },
];

export default function PayrollSection() {
  return (
    <section id="payroll" className="scroll-mt-20 bg-slate-950 text-white">
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Kenya tax compliance built in
            </p>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Payroll built for <span className="text-grad-light">Kenyan businesses.</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-300">
              Process payroll, calculate statutory deductions and generate professional payslips
              from one organized workspace.
            </p>
            <ul className="mt-6 space-y-3">
              {STATUTORY.map((s) => (
                <li key={s.label} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-emerald-500/15 text-sm font-bold text-emerald-300">
                    {s.label.slice(0, 1)}
                  </span>
                  <div>
                    <p className="font-semibold">{s.label}</p>
                    <p className="text-sm text-slate-400">{s.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Sample payslip */}
          <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sample payslip · March 2026</p>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Ready to print</span>
            </div>
            <div className="mt-4 space-y-2.5">
              {[
                ["Basic pay", "KSh 75,000.00"],
                ["NSSF", "KSh 4,500.00"],
                ["SHIF", "KSh 2,062.50"],
                ["Housing Levy", "KSh 1,125.00"],
                ["Taxable pay", "KSh 67,312.50"],
                ["PAYE", "KSh 12,577.08"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/5 py-2 text-sm">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-white">{v}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 text-sm font-bold text-emerald-300">
                <span>Net pay</span>
                <span>KSh 54,735.39</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-12 max-w-3xl text-xs leading-relaxed text-slate-500">
          Statutory deduction rates are maintained in one central payroll configuration rather than
          scattered across the product, so they can be updated as KRA, NSSF and SHIF regulations
          change. While we work to keep rates current, please verify figures against the latest
          official announcements from KRA, NSSF and the Social Health Authority.
        </p>
      </div>
    </section>
  );
}