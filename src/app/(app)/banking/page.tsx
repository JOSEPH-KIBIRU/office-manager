"use client";

import { useEffect, useState } from "react";
import { PageHeader, Alert } from "@/components/ui";

interface Dash {
  totalCash: number;
  totalBank: number;
  totalMpesa: number;
  total: number;
  parts: Array<{ code: string; name: string; kind: string; balance: number }>;
  unreconciled: number;
  lastReconciliation: { periodEnd: string; accountCode: string; completedAt: number | null; difference: number } | null;
  movement: { month: string; cashIn: number; cashOut: number };
}

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function BankingDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/banking/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Banking" subtitle="Cash, bank and M-Pesa position with reconciliation status." />
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Total cash", value: data.totalCash },
              { label: "Total bank", value: data.totalBank },
              { label: "Total M-Pesa", value: data.totalMpesa },
              { label: "Combined", value: data.total },
            ].map((c) => (
              <div key={c.label} className="card p-4">
                <p className="text-xs font-medium text-slate-500">{c.label}</p>
                <p className={`mt-1 text-2xl font-bold ${c.value < 0 ? "text-red-600" : "text-slate-900"}`}>{fmtKsh(c.value)}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500">Unreconciled transactions</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">{data.unreconciled}</p>
              <a href="/banking/transactions" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">Go to reconciliation →</a>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500">Last reconciliation</p>
              {data.lastReconciliation ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{data.lastReconciliation.accountCode}</p>
                  <p className="text-xs text-slate-500">as at {data.lastReconciliation.periodEnd}</p>
                  <p className={`text-xs font-semibold ${data.lastReconciliation.difference === 0 ? "text-emerald-600" : "text-red-600"}`}>
                    Difference {fmtKsh(data.lastReconciliation.difference)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-400">None yet</p>
              )}
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500">Cash movement ({data.movement.month})</p>
              <p className="mt-1 text-sm text-slate-700">In: <span className="font-semibold text-emerald-700">{fmtKsh(data.movement.cashIn)}</span></p>
              <p className="text-sm text-slate-700">Out: <span className="font-semibold text-red-700">{fmtKsh(data.movement.cashOut)}</span></p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Accounts
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.parts.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No cash/bank accounts yet.</td></tr>
                )}
                {data.parts.map((p) => (
                  <tr key={p.code}>
                    <td className="px-4 py-2 font-mono text-slate-500">{p.code}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-2 capitalize text-slate-600">{p.kind}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${p.balance < 0 ? "text-red-600" : "text-slate-700"}`}>{fmtKsh(p.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
