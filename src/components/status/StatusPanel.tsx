"use client";

import { useCallback, useEffect, useState } from "react";

interface Health {
  status: "ok" | "degraded";
  time: string;
  checks: {
    app: string;
    convex: string;
    latencyMs: number;
  };
}

type State =
  | { kind: "checking" }
  | { kind: "ok"; data: Health; checkedAt: Date }
  | { kind: "degraded"; data: Health; checkedAt: Date }
  | { kind: "unreachable"; checkedAt: Date };

export default function StatusPanel() {
  const [state, setState] = useState<State>({ kind: "checking" });

  const check = useCallback(async () => {
    setState({ kind: "checking" });
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = (await res.json()) as Health;
      const checkedAt = new Date();
      setState(
        res.ok && data.status === "ok"
          ? { kind: "ok", data, checkedAt }
          : { kind: "degraded", data, checkedAt }
      );
    } catch {
      setState({ kind: "unreachable", checkedAt: new Date() });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const checkedLabel =
    state.kind === "checking"
      ? "Checking now…"
      : `Last checked at ${state.checkedAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`;

  const overall =
    state.kind === "ok"
      ? { label: "All systems operational", tone: "bg-emerald-50 border-emerald-200 text-emerald-900", dot: "bg-emerald-600" }
      : state.kind === "checking"
      ? { label: "Checking system status", tone: "bg-slate-50 border-slate-200 text-slate-900", dot: "bg-slate-400" }
      : { label: "A service is unavailable", tone: "bg-amber-50 border-amber-200 text-amber-900", dot: "bg-amber-500" };

  const rows = [
    {
      name: "Web application",
      detail: "Pages, sign-in and the public site",
      up: state.kind === "ok" || state.kind === "degraded",
    },
    {
      name: "Database & functions",
      detail: "Company records and background operations",
      up: state.kind === "ok" ? true : state.kind === "degraded" ? state.data.checks.convex === "up" : false,
    },
    {
      name: "File storage",
      detail: "Documents and uploaded files",
      up: state.kind === "ok",
    },
    {
      name: "Email & SMS delivery",
      detail: "Notifications, payslips and alerts",
      up: state.kind === "ok",
    },
  ];

  return (
    <div>
      <div className={`rounded-2xl border p-6 ${overall.tone}`} role="status" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className={`h-3 w-3 rounded-full ${overall.dot}`} />
            <div>
              <p className="text-lg font-bold">{overall.label}</p>
              <p className="mt-0.5 text-sm opacity-80">{checkedLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void check()}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white/70 px-4 py-2 text-sm font-semibold transition hover:bg-white"
          >
            Check again
          </button>
        </div>

        {state.kind === "ok" && (
          <p className="mt-3 text-sm opacity-80">
            Database response time: {state.data.checks.latencyMs} ms.
          </p>
        )}
        {state.kind === "unreachable" && (
          <p className="mt-3 text-sm opacity-80">
            We could not reach the health endpoint. The service may be temporarily unavailable, or
            your connection may be interrupted. Try again in a moment.
          </p>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Current status of Office Manager services</caption>
          <thead className="bg-slate-100">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold text-slate-900">Service</th>
              <th scope="col" className="px-4 py-3 font-semibold text-slate-900">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-slate-200">
                <th scope="row" className="px-4 py-4 font-medium text-slate-900">
                  {row.name}
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">{row.detail}</span>
                </th>
                <td className="px-4 py-4">
                  {state.kind === "checking" ? (
                    <span className="text-slate-500">Checking…</span>
                  ) : row.up ? (
                    <span className="font-semibold text-emerald-700">Operational</span>
                  ) : (
                    <span className="font-semibold text-amber-700">Unavailable</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        This page checks the live application and database on each visit. It does not show historical
        uptime. For an incident that affects your account, contact support.
      </p>
    </div>
  );
}
