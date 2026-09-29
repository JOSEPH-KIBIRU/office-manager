/**
 * HR section — sample employee directory UI. All data is fictional.
 */
const DIRECTORY = [
  { name: "Jane Wanjiku", role: "Operations Manager", email: "jane@savannah.co.ke", dept: "Management", leave: "16 days", badge: "bg-blue-50 text-blue-700" },
  { name: "Brian Otieno", role: "Sales Executive", email: "brian@savannah.co.ke", dept: "Sales", leave: "21 days", badge: "bg-emerald-50 text-emerald-700" },
  { name: "Amina Hassan", role: "Accountant", email: "amina@savannah.co.ke", dept: "Finance", leave: "12 days", badge: "bg-sky-50 text-sky-700" },
  { name: "Peter Mwangi", role: "Operations Officer", email: "peter@savannah.co.ke", dept: "Operations", leave: "9 days", badge: "bg-amber-50 text-amber-700" },
  { name: "Faith Chebet", role: "Secretary", email: "faith@savannah.co.ke", dept: "Admin", leave: "18 days", badge: "bg-indigo-50 text-indigo-700" },
];

export default function HrSection() {
  return (
    <section id="hr" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">People & HR</p>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Your employee records, <span className="text-grad">organized.</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Keep employees, employment information, leave and payroll history in one place that
              the whole team can actually use.
            </p>
            <ul className="mt-6 grid gap-2.5 text-sm sm:grid-cols-2">
              {["Employees & staff records", "Roles and access levels", "Departments", "Leave management", "Employee documents", "Payroll history", "Payslips & P9"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-slate-700">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true" className="h-4 w-4 flex-none text-emerald-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <a href="#contact" className="btn-grad mt-8">
              Request a Demo
            </a>
          </div>

          {/* Sample directory UI */}
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-lg shadow-slate-900/5 ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">Employee directory · 24 staff</p>
              <div className="flex gap-1.5">
                <span className="rounded-md bg-white px-2.5 py-1 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">🔍 Search</span>
                <span className="rounded-md bg-white px-2.5 py-1 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">Filter</span>
              </div>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="hidden border-b border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1.6fr_1fr_1fr_.8fr]">
                <span>Employee</span>
                <span>Role</span>
                <span>Department</span>
                <span className="text-right">Leave</span>
              </div>
              {DIRECTORY.map((e, i) => (
                <div
                  key={e.name}
                  className={`grid grid-cols-2 items-center gap-2 px-3 py-2.5 sm:grid-cols-[1.6fr_1fr_1fr_.8fr] ${
                    i % 2 ? "bg-slate-50/50" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-blue-700 text-[9px] font-bold text-white">
                      {e.name.split(" ").map((x) => x[0]).join("")}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-semibold text-slate-800">{e.name}</div>
                      <div className="truncate text-[9px] text-slate-400">{e.email}</div>
                    </div>
                  </div>
                  <span className="truncate text-[11px] text-slate-600">{e.role}</span>
                  <span className="hidden truncate text-[11px] text-slate-500 sm:block">{e.dept}</span>
                  <span className={`justify-self-end rounded px-1.5 py-0.5 text-[9px] font-semibold ${e.badge}`}>
                    {e.leave}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Sample data shown for illustration.</p>
          </div>
        </div>
      </div>
    </section>
  );
}