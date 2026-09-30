"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import Spinner from "@/components/Spinner";

interface Org {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  archived: boolean;
}

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

const ACTION_OPTIONS = [
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
  "subscriptions.update",
  "subscriptions.lifecycle",
  "payroll.run",
  "invoice.create",
  "invoice.delete",
  "leave.approve",
  "leave.reject",
];

const MODULE_OPTIONS = [
  "auth",
  "users",
  "platform",
  "payroll",
  "invoices",
  "backup",
  "features",
  "subscriptions",
  "leaves",
  "documents",
  "assets",
  "meetings",
  "minutes",
  "pettyCash",
];

function fmtEAT(ms: number): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(ms)) + " EAT"
  );
}

export default function AdminAuditPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busyMore, setBusyMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api<{ orgs: Org[] }>("/api/admin/companies")
      .then((d) => {
        const list = d.orgs.filter((o) => o.slug !== "__platform");
        setOrgs(list);
        const pre = new URLSearchParams(window.location.search).get("orgId");
        setOrgId(pre && list.some((o) => o.id === pre) ? pre : (list[0]?.id ?? ""));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load companies"))
      .finally(() => setLoadingOrgs(false));
  }, []);

  const load = useCallback(
    async (reset: boolean, before: number | null) => {
      if (!orgId) return;
      if (reset) setLoading(true);
      else setBusyMore(true);
      try {
        const u = new URLSearchParams({ orgId, limit: "100" });
        if (module) u.set("module", module);
        if (action) u.set("action", action);
        if (!reset && before) u.set("before", String(before));
        const d = await api<{ items: AuditItem[]; total: number; nextBefore: number | null }>(
          `/api/admin/audit?${u.toString()}`
        );
        setItems((prev) => (reset ? d.items : [...prev, ...d.items]));
        setTotal(d.total);
        setNextBefore(d.nextBefore);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load audit trail");
      } finally {
        setLoading(false);
        setBusyMore(false);
      }
    },
    [orgId, module, action]
  );

  useEffect(() => {
    if (orgId) void load(true, null);
  }, [orgId, module, action, load]);

  const filtered = q
    ? items.filter(
        (i) =>
          i.summary.toLowerCase().includes(q.toLowerCase()) ||
          i.actorName.toLowerCase().includes(q.toLowerCase())
      )
    : items;

  const selected = orgs.find((o) => o.id === orgId);
  const exportHref = orgId ? `/api/admin/audit/export?orgId=${encodeURIComponent(orgId)}` : "#";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit trail"
        subtitle="Pull the full activity trail for any company. This includes platform actions; companies only ever see activity within their own company."
        action={
          orgId ? (
            <a href={exportHref} className="btn-secondary text-xs">
              Export CSV
            </a>
          ) : undefined
        }
      />

      {error && <Alert kind="error">{error}</Alert>}

      {loadingOrgs ? (
        <div className="flex items-center gap-3 text-slate-500">
          <Spinner className="h-5 w-5" /> Loading companies…
        </div>
      ) : (
        <>
          <div className="card max-w-xl p-5">
            <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
            <select className="input" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {orgs.length === 0 && <option value="">No companies</option>}
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.archived ? " — archived" : !o.active ? " — suspended" : ""}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <select value={module} onChange={(e) => setModule(e.target.value)} className="input max-w-[14rem]">
                  <option value="">All modules</option>
                  {MODULE_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select value={action} onChange={(e) => setAction(e.target.value)} className="input max-w-[14rem]">
                  <option value="">All actions</option>
                  {ACTION_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
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
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading…</td>
                        </tr>
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                            No audit entries for this company yet.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((i) => {
                          const platform = i.actorRole === "super_admin";
                          return (
                            <tr key={i.id} className={`align-top ${platform ? "bg-indigo-50/40" : ""}`}>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtEAT(i.createdAt)}</td>
                              <td className="px-4 py-3">
                                <span className="font-medium text-slate-800">{i.actorName}</span>
                                {platform ? (
                                  <span className="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                                    platform
                                  </span>
                                ) : (
                                  <span className="ml-1 text-xs text-slate-400">{i.actorRole}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                                  {i.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{i.module}</td>
                              <td className="px-4 py-3 text-slate-600">{i.summary}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                  <span>{total} total</span>
                  {nextBefore && (
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => load(false, nextBefore)}
                      disabled={busyMore}
                    >
                      {busyMore ? "Loading…" : "Load more"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
