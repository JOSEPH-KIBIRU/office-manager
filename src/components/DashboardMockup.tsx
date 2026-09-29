/**
 * Fictional Office Manager dashboard preview for the landing hero.
 * All numbers, names and records are invented sample data.
 * This is the "screen contents" only — the hero supplies the device frame.
 */
export default function DashboardMockup() {
  return (
    <div aria-hidden="true" className="flex bg-slate-50 text-slate-900">
      {/* App sidebar */}
      <div className="hidden w-40 flex-none flex-col gap-1 border-r border-slate-200 bg-white p-3 text-xs sm:flex">
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-700 text-[9px] font-bold text-white">OM</span>
          <span className="truncate font-semibold text-slate-800">Office Manager</span>
        </div>
        {["Dashboard", "Payroll", "Leave", "Petty Cash", "Car Logs", "Meetings", "Invoices", "Reports"].map((item, i) => (
          <div key={item} className={`rounded-md px-2.5 py-1.5 font-medium ${i === 0 ? "bg-blue-600 text-white shadow-sm" : "text-slate-500"}`}>
            {item}
          </div>
        ))}
        <div className="mt-auto rounded-md bg-slate-50 px-2.5 py-1.5 text-slate-400">Settings</div>
      </div>

      {/* App main */}
      <div className="min-w-0 flex-1">
        {/* App top bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
          <div className="hidden flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] text-slate-400 sm:flex">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            Search employees, invoices, requests…
          </div>
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-red-500 text-[8px] font-bold leading-[14px] text-white">3</span>
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-[10px] font-semibold text-white">WK</span>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">Good morning, Wanjiku 👋</div>
              <div className="text-[11px] text-slate-400">Here&apos;s what&apos;s happening at your office today</div>
            </div>
            <span className="hidden rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 sm:block">March 2026</span>
          </div>

          {/* Stat cards */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Payroll this month", value: "KES 1,420,000", sub: "+4.2% vs Feb", tone: "text-emerald-600" },
              { label: "Pending leave", value: "6", sub: "2 awaiting approval", tone: "text-amber-600" },
              { label: "Open petty cash", value: "KES 84,500", sub: "3 requests", tone: "text-slate-500" },
              { label: "Overdue invoices", value: "KES 312,000", sub: "5 invoices", tone: "text-red-600" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-[10px] font-medium text-slate-400">{s.label}</div>
                <div className="mt-1 text-sm font-bold text-slate-900">{s.value}</div>
                <div className={`text-[10px] font-medium ${s.tone}`}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-5">
            {/* Chart */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:col-span-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-slate-700">Salary vs Deductions</div>
                <div className="flex items-center gap-2 text-[9px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-600" /> Gross</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-indigo-300" /> Deductions</span>
                </div>
              </div>
              <div className="mt-3 flex h-32 items-end gap-1.5">
                {[38, 52, 44, 68, 58, 82, 74, 94].map((h, i) => (
                  <div key={i} className="flex flex-1 items-end gap-0.5">
                    <div className="flex-1 rounded-t bg-blue-600" style={{ height: `${h}%` }} />
                    <div className="flex-1 rounded-t bg-indigo-300" style={{ height: `${Math.round(h * 0.45)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-slate-400">
                {["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>

            {/* Approvals */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-slate-700">Pending approvals</div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">3</span>
              </div>
              <div className="mt-2 space-y-2">
                {[
                  { name: "Brian Otieno", label: "Annual leave · 3 days", cls: "bg-blue-100 text-blue-700" },
                  { name: "Amina Hassan", label: "Petty cash · KES 12,000", cls: "bg-amber-100 text-amber-700" },
                  { name: "Peter Mwangi", label: "Car repair · KES 38,000", cls: "bg-slate-100 text-slate-600" },
                ].map((p) => (
                  <div key={p.name} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-200 text-[8px] font-bold text-slate-500">
                      {p.name.split(" ").map((x) => x[0]).join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-semibold text-slate-700">{p.name}</div>
                      <div className="truncate text-[9px] text-slate-400">{p.label}</div>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${p.cls}`}>Approve</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
