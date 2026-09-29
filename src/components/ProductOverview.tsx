/**
 * Product overview — a bento-style grid of the major product areas.
 * Only advertises areas that exist in the product today.
 */
function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICONS = {
  payroll: "M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z",
  users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  finance: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
  expenses: "M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185ZM9.75 9h.008v.008H9.75V9Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5h.008v.008h-.008V13.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z",
  operations: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z",
  tasks: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
};

function Tile({ icon }: { icon: string }) {
  return (
    <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
      <Icon d={icon} className="h-5 w-5" />
    </span>
  );
}

export default function ProductOverview() {
  return (
    <section id="features" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">The platform</p>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Everything your office needs. <span className="text-grad">One platform.</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Replace scattered spreadsheets, paperwork and disconnected tools with one secure workspace.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-6">
          {/* Payroll — feature card */}
          <div className="card-hover relative overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-50 p-6 md:col-span-4">
            <div className="flex items-start gap-4">
              <Tile icon={ICONS.payroll} />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Payroll</h3>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-600">
                  KRA-ready payroll with PAYE, NSSF, SHIF, Housing Levy and HELB, plus digital payslips and P9.
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              {[
                ["Gross pay", "KES 150,010"],
                ["PAYE", "KES 33,530"],
                ["NSSF · SHIF · Housing", "KES 12,855"],
                ["Net pay", "KES 101,125"],
              ].map(([k, v], i) => (
                <div key={k} className={`flex justify-between py-1.5 text-sm ${i === 3 ? "border-t border-slate-200 pt-2 font-bold text-slate-900" : "text-slate-600"}`}>
                  <span>{k}</span>
                  <span className="tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* HR */}
          <div className="card-hover rounded-3xl border border-slate-200/80 bg-white p-6 md:col-span-2">
            <Tile icon={ICONS.users} />
            <h3 className="mt-4 text-base font-semibold text-slate-900">HR</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Employee records, roles, departments and leave in one place.
            </p>
            <div className="mt-5 space-y-2">
              {["Jane W.", "Brian O.", "Amina H."].map((n) => (
                <div key={n} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-[9px] font-bold text-white">{n.split(" ").map((x) => x[0]).join("")}</span>
                  <span className="text-xs font-medium text-slate-700">{n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Finance */}
          <div className="card-hover rounded-3xl border border-slate-200/80 bg-white p-6 md:col-span-2">
            <Tile icon={ICONS.finance} />
            <h3 className="mt-4 text-base font-semibold text-slate-900">Finance</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Invoicing, bills and payment tracking with clear statuses.
            </p>
            <div className="mt-5 flex h-20 items-end gap-1.5">
              {[40, 65, 52, 80, 68, 92].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-blue-600 to-indigo-400" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          {/* Expenses */}
          <div className="card-hover rounded-3xl border border-slate-200/80 bg-white p-6 md:col-span-2">
            <Tile icon={ICONS.expenses} />
            <h3 className="mt-4 text-base font-semibold text-slate-900">Expenses</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Petty cash and car-log claims with one-tap approvals.
            </p>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs text-slate-500">Monthly float remaining</p>
                <p className="text-lg font-bold text-slate-900">KES 12,500</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">On budget</span>
            </div>
          </div>

          {/* Operations */}
          <div className="card-hover rounded-3xl border border-slate-200/80 bg-white p-6 md:col-span-2">
            <Tile icon={ICONS.operations} />
            <h3 className="mt-4 text-base font-semibold text-slate-900">Operations</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Meetings, minutes and day-to-day admin kept organized.
            </p>
            <div className="mt-5 space-y-2">
              {["Meeting · 10:00", "Minutes saved", "Task approved"].map((t) => (
                <div key={t} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-slate-900 text-white"><Icon d={ICONS.tasks} className="h-3 w-3" /></span>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
