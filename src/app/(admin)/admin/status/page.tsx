"use client";

import { useEffect, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";

interface Summary {
  status: string;
  lastCheckedAt: number | null;
  lastLatencyMs: number | null;
  currentDown: boolean;
  downSince: number | null;
  uptime: Record<string, number | null>;
  incidents: Array<{ startedAt: number; endedAt: number | null }>;
  totalChecks: number;
}

interface Check {
  id: string;
  status: string;
  source: string | null;
  latencyMs: number | null;
  error: string | null;
  checkedAt: number;
}

function fmt(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms)) + " EAT";
}

function pct(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}

export default function StatusPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const d = await api<{ summary: Summary; checks: Check[] }>("/api/admin/status");
      setSummary(d.summary);
      setChecks(d.checks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const ok = summary?.status === "up";

  return (
    <div className="space-y-6">
      <PageHeader title="System status" subtitle="Platform health, uptime and recent checks." />

      {error && <Alert kind="error">{error}</Alert>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500">Current status</p>
              <p className={`mt-1 inline-flex items-center gap-2 text-lg font-bold ${ok ? "text-emerald-600" : "text-red-600"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
                {summary.status === "up" ? "Operational" : summary.status === "down" ? "Outage" : "Unknown"}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500">Last check</p>
              <p className="mt-1 text-lg font-bold text-slate-800">
                {summary.lastCheckedAt ? fmt(summary.lastCheckedAt) : "—"}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500">Latency</p>
              <p className="mt-1 text-lg font-bold text-slate-800">
                {summary.lastLatencyMs != null ? `${summary.lastLatencyMs} ms` : "—"}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500">Checks recorded</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{summary.totalChecks}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(["24h", "7d", "30d"] as const).map((k) => (
              <div key={k} className="card p-4">
                <p className="text-xs font-medium text-slate-500">Uptime ({k})</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{pct(summary.uptime[k])}</p>
              </div>
            ))}
          </div>

          {summary.currentDown && summary.downSince && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Ongoing outage since {fmt(summary.downSince)}.
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              Recent incidents
            </div>
            {summary.incidents.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No incidents recorded.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {summary.incidents.map((i, idx) => (
                  <li key={idx} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-slate-600">{fmt(i.startedAt)}</span>
                    <span className={i.endedAt ? "text-emerald-600" : "text-red-600"}>
                      {i.endedAt ? `Resolved ${fmt(i.endedAt)}` : "Ongoing"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              Recent checks
            </div>
            {checks.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No checks recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {checks.slice(0, 30).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="text-slate-500">{fmt(c.checkedAt)}</span>
                    <span className="flex items-center gap-2">
                      {c.latencyMs != null && <span className="text-xs text-slate-400">{c.latencyMs} ms</span>}
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${c.status === "up" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {c.status}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
