"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";

interface AgingRow {
  contactId: string;
  contactName: string;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
  total: number;
}

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const BUCKETS: Array<{ key: keyof AgingRow; label: string }> = [
  { key: "current", label: "Current" },
  { key: "d1_30", label: "1–30 days" },
  { key: "d31_60", label: "31–60 days" },
  { key: "d61_90", label: "61–90 days" },
  { key: "d90plus", label: "90+ days" },
];

export default function AgingPage() {
  const [type, setType] = useState<"ar" | "ap">("ar");
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [totals, setTotals] = useState<AgingRow | null>(null);
  const [asAt, setAsAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ rows: AgingRow[]; totals: AgingRow; asAt: string }>(`/api/accounting/aging?type=${type}`);
      setRows(d.rows);
      setTotals(d.totals);
      setAsAt(d.asAt);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load aging");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    const header = ["Contact", ...BUCKETS.map((b) => b.label), "Total"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([r.contactName, ...BUCKETS.map((b) => String(r[b.key] ?? 0)), String(r.total)].join(","));
    }
    if (totals) lines.push(["Totals", ...BUCKETS.map((b) => String(totals[b.key] ?? 0)), String(totals.total)].join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-aging-${asAt || "today"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={type === "ar" ? "Accounts receivable aging" : "Accounts payable aging"}
        subtitle="Outstanding balances by age, as at today. Current = not yet due."
        action={
          <button className="btn-secondary text-xs" onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </button>
        }
      />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        {(["ar", "ap"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              type === t ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t === "ar" ? "Accounts receivable" : "Accounts payable"}
          </button>
        ))}
        {asAt && <span className="ml-auto text-sm text-slate-500">As at {asAt}</span>}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="card p-6 text-sm text-slate-400">No outstanding balances. 🎉</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">{type === "ar" ? "Customer" : "Supplier"}</th>
                {BUCKETS.map((b) => (
                  <th key={b.key} className="px-4 py-3 text-right">{b.label}</th>
                ))}
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.contactId}>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.contactName}</td>
                  {BUCKETS.map((b) => (
                    <td key={b.key} className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {Number(r[b.key] ?? 0) ? fmtKsh(Number(r[b.key])) : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{fmtKsh(r.total)}</td>
                </tr>
              ))}
              {totals && (
                <tr className="border-t-2 border-slate-900 bg-slate-50 font-semibold">
                  <td className="px-4 py-3">Totals</td>
                  {BUCKETS.map((b) => (
                    <td key={b.key} className="px-4 py-3 text-right tabular-nums">{Number(totals[b.key] ?? 0) ? fmtKsh(Number(totals[b.key])) : "—"}</td>
                  ))}
                  <td className="px-4 py-3 text-right tabular-nums">{fmtKsh(totals.total)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
