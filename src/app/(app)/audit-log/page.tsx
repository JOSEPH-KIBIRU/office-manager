"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { MODULES } from "@/lib/permissions";

interface AuditItem {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  ip: string | null;
  createdAt: number;
}

const ACTIONS = [
  "login",
  "user.create",
  "user.update",
  "user.role_change",
  "user.deactivate",
  "user.delete",
  "company.create",
  "company.suspend",
  "company.reactivate",
  "company.archive",
  "company.restore",
  "company.delete",
  "backup.create",
  "backup.delete",
  "backup.restore",
  "permissions.update",
  "features.update",
  "payroll.run",
  "invoice.create",
  "invoice.delete",
  "leave.approve",
  "leave.reject",
];

function fmtEAT(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms)) + " EAT";
}

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyMore, setBusyMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const toast = useToast();

  const query = useMemo(
    () =>
      new URLSearchParams({
        limit: "100",
        ...(module ? { module } : {}),
        ...(action ? { action } : {}),
      }),
    [module, action]
  );

  async function load(reset: boolean) {
    if (reset) setLoading(true);
    else setBusyMore(true);
    try {
      const u = new URLSearchParams(query);
      if (!reset && nextBefore) u.set("before", String(nextBefore));
      const d = await api<{ items: AuditItem[]; total: number; nextBefore: number | null }>(
        `/api/audit?${u.toString()}`
      );
      setItems((prev) => (reset ? d.items : [...prev, ...d.items]));
      setTotal(d.total);
      setNextBefore(d.nextBefore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
      setBusyMore(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, action]);

  const filtered = q
    ? items.filter(
        (i) =>
          i.summary.toLowerCase().includes(q.toLowerCase()) ||
          i.actorName.toLowerCase().includes(q.toLowerCase())
      )
    : items;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        subtitle="A record of important actions across your company — who did what and when."
        action={
          <a href="/api/audit/export" className="btn-secondary text-xs">
            Export CSV
          </a>
        }
      />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <select value={module} onChange={(e) => setModule(e.target.value)} className="input max-w-[14rem]">
          <option value="">All modules</option>
          {MODULES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="input max-w-[14rem]">
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search actor or summary…"
          className="input max-w-[16rem]"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Module</th>
                <th className="px-4 py-3 font-semibold">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                filtered.map((i) => (
                  <tr key={i.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtEAT(i.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{i.actorName}</span>
                      <span className="ml-1 text-xs text-slate-400">{i.actorRole}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                        {i.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{i.module}</td>
                    <td className="px-4 py-3 text-slate-600">{i.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <span>{total} total</span>
          {nextBefore && (
            <button className="btn-secondary text-xs" onClick={() => load(false)} disabled={busyMore}>
              {busyMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
