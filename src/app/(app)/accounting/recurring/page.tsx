"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, Modal, ConfirmDialog, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Recurring {
  _id: string; kind: string; name: string; description: string | null; frequency: string;
  startDate: string; endDate: string | null; nextRun: string; amount: number; accountCode: string | null;
  vatRate: number | null; active: boolean; lastRunAt: string | null;
}
interface Account { code: string; name: string; isCash: boolean; active: boolean; }

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);

const empty = { kind: "expense" as "bill" | "expense" | "journal", name: "", description: "", frequency: "monthly" as "weekly" | "monthly" | "quarterly" | "yearly", startDate: today(), endDate: "", amount: "", accountCode: "", vatRate: "0", costCentre: "", project: "" };

export default function RecurringPage() {
  const [rows, setRows] = useState<Recurring[]>([]);
  const [chart, setChart] = useState<Account[]>([]);
  const [costCentres, setCostCentres] = useState<{ code: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ _id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteFor, setDeleteFor] = useState<Recurring | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try { const d = await api<{ recurring: Recurring[] }>("/api/accounting/recurring"); setRows(d.recurring); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
  }, []);

  useEffect(() => {
    void load();
    api<{ accounts: Account[] }>("/api/accounting/chart").then((d) => setChart(d.accounts.filter((a) => a.active && !a.isCash))).catch(() => setChart([]));
    api<{ costCentres: { code: string; name: string }[] }>("/api/management/cost-centres").then((d) => setCostCentres(d.costCentres ?? [])).catch(() => setCostCentres([]));
    api<{ projects: { _id: string; name: string }[] }>("/api/management/projects").then((d) => setProjects(d.projects ?? [])).catch(() => setProjects([]));
  }, [load]);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    try {
      await api("/api/accounting/recurring", {
        method: "POST",
        json: { kind: form.kind, name: form.name, description: form.description, frequency: form.frequency, startDate: form.startDate, endDate: form.endDate || undefined, amount: Number(form.amount) || 0, accountCode: form.accountCode || undefined, vatRate: Number(form.vatRate) || 0, costCenterCode: form.costCentre || undefined, projectId: form.project || undefined },
      });
      toast.success("Recurring template created.");
      setForm(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); }
    finally { setBusy(false); }
  }

  async function runNow() {
    setBusy(true);
    try {
      const res = await api<{ processed: number }>("/api/accounting/recurring/run", { method: "POST", json: { asOf: today() } });
      toast.success(`Processed ${res.processed} entry(ies).`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Run failed"); }
    finally { setBusy(false); }
  }

  async function toggle(r: Recurring) {
    try { await api(`/api/accounting/recurring/${r._id}`, { method: "PATCH", json: { active: !r.active } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function doDelete() {
    if (!deleteFor) return;
    setBusy(true);
    try { await api(`/api/accounting/recurring/${deleteFor._id}`, { method: "DELETE" }); setDeleteFor(null); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Recurring transactions" subtitle="Templates for recurring bills, expenses and journals. Each run posts a balanced journal (idempotent per run date)." />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={runNow} disabled={busy}>Run due now</button>
        <button className="btn-primary" onClick={() => setForm({ ...empty })}>+ New template</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Frequency</th>
              <th className="px-4 py-3">Next run</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Active</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No recurring templates yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r._id} className={r.active ? "" : "opacity-50"}>
                <td className="px-4 py-3 font-medium text-slate-800">{r.name}{r.description && <span className="block text-xs text-slate-400">{r.description}</span>}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{r.kind}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{r.frequency}</td>
                <td className="px-4 py-3 text-slate-600">{r.nextRun}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.kind === "journal" ? "—" : fmtKsh(r.amount)}</td>
                <td className="px-4 py-3"><input type="checkbox" checked={r.active} onChange={() => toggle(r)} /></td>
                <td className="px-4 py-3 text-right"><button className="btn-secondary btn-xs text-red-600" onClick={() => setDeleteFor(r)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title="New recurring template" onClose={() => setForm(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select className={inputCls()} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as never })}>
                  <option value="expense">Expense (Cr Bank)</option>
                  <option value="bill">Bill (Cr Accounts payable)</option>
                </select>
              </div>
              <div>
                <label className="label">Frequency</label>
                <select className={inputCls()} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as never })}>
                  <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            <div><label className="label">Name</label><input className={inputCls()} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Description</label><input className={inputCls()} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Start date</label><input type="date" className={inputCls()} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><label className="label">End date</label><input type="date" className={inputCls()} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
              <div><label className="label">Amount</label><input type="number" className={inputCls()} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Expense account</label>
                <select className={inputCls()} value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })}>
                  <option value="">General expenses (5990)</option>
                  {chart.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </select>
              </div>
              <div><label className="label">VAT %</label><input type="number" className={inputCls()} value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })} /></div>
            </div>
            {(costCentres.length > 0 || projects.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cost centre (optional)</label>
                  <select className={inputCls()} value={form.costCentre} onChange={(e) => setForm({ ...form, costCentre: e.target.value })}>
                    <option value="">—</option>
                    {costCentres.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Project (optional)</label>
                  <select className={inputCls()} value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>
                    <option value="">—</option>
                    {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Create template"}</button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={deleteFor !== null} title="Delete template" message={<>Delete <strong>{deleteFor?.name}</strong>? Posted entries are not affected.</>} confirmLabel="Delete" busy={busy} onConfirm={doDelete} onCancel={() => setDeleteFor(null)} />
    </div>
  );
}
