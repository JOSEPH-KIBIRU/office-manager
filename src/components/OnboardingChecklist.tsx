"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Status {
  branding: boolean;
  team: number;
  departments: number;
  payrolls: number;
  invoices: number;
}

const DISMISS_KEY = "om_onboarding_dismissed";

const STEPS: { key: keyof Status | "branding"; label: string; href: string; done: (s: Status) => boolean }[] = [
  { key: "branding", label: "Add your company details (logo, address)", href: "/organization", done: (s) => s.branding },
  { key: "team", label: "Add your team members", href: "/users", done: (s) => s.team > 1 },
  { key: "departments", label: "Create a department", href: "/departments", done: (s) => s.departments > 0 },
  { key: "payrolls", label: "Run your first payroll", href: "/payroll", done: (s) => s.payrolls > 0 },
  { key: "invoices", label: "Create your first invoice", href: "/invoices", done: (s) => s.invoices > 0 },
];

export default function OnboardingChecklist() {
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    fetch("/api/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status) setStatus(d.status as Status);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (dismissed || !status) return null;

  const doneCount = STEPS.filter((s) => s.done(status)).length;
  if (doneCount === STEPS.length) return null;

  const pct = Math.round((doneCount / STEPS.length) * 100);

  return (
    <section className="card mb-6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Get started with Office Manager</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {doneCount} of {STEPS.length} done — finish setting up your workspace.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss getting started checklist"
          className="text-slate-400 transition hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 space-y-1.5">
        {STEPS.map((s) => {
          const done = s.done(status);
          return (
            <li key={s.label}>
              <Link
                href={s.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  done ? "text-slate-400" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-bold ${
                    done ? "bg-emerald-500 text-white" : "border border-slate-300 text-transparent"
                  }`}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <span className={done ? "line-through" : "font-medium"}>{s.label}</span>
                {!done && <span className="ml-auto text-xs font-semibold text-indigo-600">Start →</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
