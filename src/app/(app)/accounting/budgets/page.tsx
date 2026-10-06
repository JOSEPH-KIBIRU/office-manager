"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, Modal, ConfirmDialog, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Budget { _id: string; period: string; frequency: string; accountCode: string; accountName: string; costCenterCode: string | null; projectId: string | null; amount: number; note: string | null; }
interface Account { code: string; name: string; isCash: boolean; active: boolean; }
interface CC { _id: string; code: string; name: string; }
interface Project { _id: string; code: string; name: string; }

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const curYear = String(new Date().getFullYear());
const empty = { period: curYear, frequency: "annual" as "annual" | "monthly", accountCode: "", costCenterCode: "", projectId: "", amount: "", note: "" };

export default function BudgetsPage() {
  const [rows, setRows] = useState<Budget[]>([]);
  const [chart, setChart] = useState<Account[]>([]);
  const [ccs, setCcs] = useState<CC[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteFor, setDeleteFor] = useState<Budget | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try { const d = await api<{ budgets: Budget[] }>("/api/management/budgets"); setRows(d.budgets); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
  }, []);
  useEffect(() => {
    void load();
    api<{ accounts: Account[] }>("/api/accounting/chart").then((d) => setChart(d.accounts.filter((a) => a.active && !a.isCash))).catch(() => setChart([]));
    api<{ costCentres: CC[] }>("/api/management/cost-centres").then((d) => setCcs(d.costCentres)).catch(() => setCcs([]));
    api<{ projects: Project[] }>("/api/management/projects").then((d) => setProjects(d.projects)).catch(() => setProjects([]));
  }, [load]);

  async function save() {
    if (!form || !form.accountCode || !form.amount) { setError("Account and amount are required."); return; }
    setBusy(true);
    try {
      await api("/api/management/budgets", {
        method: "POST",
        json: { period: form.period, frequency: form.frequency, accountCode: form.accountCode, costCenterCode: form.costCenterCode || undefined, projectId: form.projectId || undefined, amount: Number(form.amount), note: form.note },
      });
      toast.success("Budget saved.");
      setForm(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function doDelete() {
    if (!deleteFor) return;
    setBusy(true);
    try { await api("/api/management/budgets", { method: "DELETE", json: { id: deleteFor._id } }); setDeleteFor(null); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  const ccName = (code: string | null) => ccs.find((c) => c.code === code)?.name ?? code ?? "—";
  const prjName = (id: string | null) => projects.find((p) => p._id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title="Budgets" subtitle="Annual or monthly budgets by account, cost centre or project. Compare against actuals in Management reports." />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setForm({ ...empty })}>+ New budget</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Period</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Dimension</th><th className="px-4 py-3 text-right">Budget</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No budgets yet.</td></tr>}
            {rows.map((b) => (
              <tr key={b._id}>
                <td className="px-4 py-3 text-slate-600">{b.period}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{b.frequency}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{b.accountName}</td>
                <td className="px-4 py-3 text-slate-600">{b.projectId ? `Project: ${prjName(b.projectId)}` : b.costCenterCode ? `Cost centre: ${ccName(b.costCenterCode)}` : "Company-wide"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtKsh(b.amount)}</td>
                <td className="px-4 py-3 text-right"><button className="btn-secondary btn-xs text-red-600" onClick={() => setDeleteFor(b)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title="New budget" onClose={() => setForm(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Frequency</label>
                <select className={inputCls()} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as never })}>
                  <option value="annual">Annual</option><option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="label">{form.frequency === "annual" ? "Year (YYYY)" : "Month (YYYY-MM)"}</label>
                <input className={inputCls()} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Account</label>
              <select className={inputCls()} value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })}>
                <option value="">Select…</option>
                {chart.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Cost centre (optional)</label>
                <select className={inputCls()} value={form.costCenterCode} onChange={(e) => setForm({ ...form, costCenterCode: e.target.value })}>
                  <option value="">—</option>
                  {ccs.map((c) => <option key={c._id} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Project (optional)</label>
                <select className={inputCls()} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                  <option value="">—</option>
                  {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Amount</label><input type="number" className={inputCls()} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><label className="label">Note</label><input className={inputCls()} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save budget"}</button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={deleteFor !== null} title="Delete budget" message={<>Delete this budget line?</>} confirmLabel="Delete" busy={busy} onConfirm={doDelete} onCancel={() => setDeleteFor(null)} />
    </div>
  );
}
