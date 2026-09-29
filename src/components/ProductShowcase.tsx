"use client";

import { useState } from "react";
import DashboardMockup from "@/components/DashboardMockup";

/**
 * Interactive product showcase. The Dashboard tab renders the real dashboard
 * UI (the same component used in the hero); the other tabs render illustrative
 * sample-data views. All data shown is fictional.
 */
const TABS = ["Dashboard", "Employees", "Payroll", "Leave", "Finance", "Accounting", "Tasks"] as const;
type Tab = (typeof TABS)[number];

const PATHS: Record<Tab, string> = {
  Dashboard: "/dashboard",
  Employees: "/users",
  Payroll: "/payroll",
  Leave: "/leave",
  Finance: "/invoices",
  Accounting: "/accounting",
  Tasks: "/tasks",
};

const badge = (kind: "green" | "amber" | "red" | "blue" | "slate") =>
  ({
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-600",
  })[kind];

function EmployeesPanel() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Team directory</p>
        <div className="flex gap-1.5">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">Search</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">Filter</span>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        {[
          ["Jane Wanjiku", "Operations Manager", "Annual · 16 days left", badge("blue")],
          ["Brian Otieno", "Sales Executive", "Sick · balance intact", badge("green")],
          ["Amina Hassan", "Accountant", "Approved · 5 days", badge("green")],
          ["Peter Mwangi", "Driver", "Pending review", badge("amber")],
        ].map(([name, role, status, cls], i) => (
          <div key={name} className={`flex items-center gap-3 px-4 py-3 ${i % 2 ? "bg-white" : "bg-slate-50"}`}>
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {name.split(" ").map((x) => x[0]).join("")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">{name}</div>
              <div className="truncate text-xs text-slate-400">{role}</div>
            </div>
            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${cls as string}`}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PayrollPanel() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">March 2026 payroll</p>
        <div className="flex gap-1.5">
          <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">PAYE</span>
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">NSSF</span>
          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">SHIF</span>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {[
          ["Jane Wanjiku", "KES 118,000", "KES 96,412"],
          ["Brian Otieno", "KES 86,000", "KES 70,190"],
          ["Amina Hassan", "KES 150,000", "KES 116,053"],
          ["Peter Mwangi", "KES 45,000", "KES 39,802"],
        ].map(([name, gross, net]) => (
          <div key={name} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-800">{name}</span>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-400">Gross {gross}</span>
              <span className="font-bold text-slate-900">{net}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">Payslips generated · P9 ready for filing</p>
    </div>
  );
}

function LeavePanel() {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">Leave requests — March</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        {[
          ["Brian Otieno", "Annual · 3 days", badge("amber"), "Approve"],
          ["Amina Hassan", "Sick · 2 days", badge("amber"), "Approve"],
          ["Jane Wanjiku", "Annual · 5 days", badge("green"), "Approved"],
          ["Peter Mwangi", "Maternity · 90 days", badge("red"), "Rejected"],
        ].map(([name, label, cls, action], i) => (
          <div key={name as string} className={`flex items-center gap-3 px-4 py-3 ${i % 2 ? "bg-white" : "bg-slate-50"}`}>
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {(name as string).split(" ").map((x) => x[0]).join("")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">{name}</div>
              <div className="truncate text-xs text-slate-400">{label}</div>
            </div>
            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${cls as string}`}>{action}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">Balances update automatically on approval.</p>
    </div>
  );
}

function FinancePanel() {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">Invoices &amp; payments</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        {[
          ["INV-2026-014", "Nairobi Builders Ltd", "KES 210,000", badge("red"), "Overdue"],
          ["INV-2026-015", "Savannah Traders", "KES 96,000", badge("amber"), "Sent"],
          ["INV-2026-012", "Rift Valley Supplies", "KES 45,000", badge("green"), "Paid"],
          ["INV-2026-010", "Coastline Hotel", "KES 122,500", badge("blue"), "Draft"],
        ].map(([num, client, amt, cls, status], i) => (
          <div key={num as string} className={`flex items-center justify-between px-4 py-3 ${i % 2 ? "bg-white" : "bg-slate-50"}`}>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800">{num}</div>
              <div className="text-xs text-slate-400">{client}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">{amt}</span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${cls as string}`}>{status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountingPanel() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Trial balance — March 2026</p>
        <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Balanced</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        {[
          ["1010 · Cash at bank", "Dr", "KES 842,300"],
          ["1200 · Accounts receivable", "Dr", "KES 356,000"],
          ["2010 · Accounts payable", "Cr", "KES 96,000"],
          ["4000 · Sales revenue", "Cr", "KES 1,240,000"],
        ].map(([acct, side, amt], i) => (
          <div key={acct} className={`flex items-center justify-between px-4 py-3 ${i % 2 ? "bg-white" : "bg-slate-50"}`}>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">{acct}</div>
              <div className="text-xs text-slate-400">{side === "Dr" ? "Debit" : "Credit"}</div>
            </div>
            <span className="text-sm font-medium text-slate-600">{amt}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ["Revenue", "1,240,000", "text-slate-800"],
          ["Expenses", "610,000", "text-slate-800"],
          ["Net profit", "630,000", "text-emerald-700"],
        ].map(([label, val, cls]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-2 py-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
            <div className={`mt-0.5 text-sm font-bold ${cls}`}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksPanel() {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">Assigned tasks</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        {[
          ["Quarterly report", "J. Otieno", badge("green"), "Submitted"],
          ["Fix office printer", "A. Wanjiru", badge("amber"), "Open"],
          ["Restock stationery", "P. Mwangi", badge("blue"), "In progress"],
          ["Service vehicle KDA 123A", "P. Mwangi", badge("green"), "Acknowledged"],
        ].map(([task, who, cls, status], i) => (
          <div key={task as string} className={`flex items-center gap-3 px-4 py-3 ${i % 2 ? "bg-white" : "bg-slate-50"}`}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">{task}</div>
              <div className="truncate text-xs text-slate-400">Assigned to {who}</div>
            </div>
            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${cls as string}`}>{status}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">Reports include photos; managers acknowledge or reopen.</p>
    </div>
  );
}

const PANELS: Record<Exclude<Tab, "Dashboard">, React.ReactNode> = {
  Employees: <EmployeesPanel />,
  Payroll: <PayrollPanel />,
  Leave: <LeavePanel />,
  Finance: <FinancePanel />,
  Accounting: <AccountingPanel />,
  Tasks: <TasksPanel />,
};

export default function ProductShowcase() {
  const [active, setActive] = useState<Tab>("Dashboard");

  return (
    <section id="product-tour" className="section scroll-mt-20 overflow-hidden border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Product tour</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            A look inside
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            See how the key modules actually look. Sample data shown for illustration.
          </p>
        </div>

        {/* Segmented tabs */}
        <div className="mt-8 flex justify-center">
          <div role="tablist" aria-label="Product areas" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={active === t}
                onClick={() => setActive(t)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                  active === t
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Large product window */}
        <div className="relative mx-auto mt-10 max-w-6xl">
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-blue-600/20 via-indigo-500/20 to-violet-600/20 blur-2xl" />
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/50 ring-1 ring-white/10">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              <div className="ml-3 hidden flex-1 sm:block">
                <span className="inline-block rounded-md bg-white/10 px-3 py-1 text-[11px] font-medium text-zinc-400 ring-1 ring-white/10">
                  app.officemanager.co.ke{PATHS[active]}
                </span>
              </div>
            </div>

            {/* Window body */}
            <div key={active} className="animate-[fadeup_.35s_ease-out]">
              {active === "Dashboard" ? (
                <DashboardMockup />
              ) : (
                <div className="bg-slate-50 p-6 sm:p-10">
                  <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    {PANELS[active]}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
