"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, Modal, StatusBadge, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Project {
  _id: string; code: string; name: string; customerId: string | null; customerName: string | null;
  startDate: string | null; endDate: string | null; budget: number; status: string; active: boolean;
}
interface Customer { id: string; name: string; }

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const empty = { name: "", customerId: "", startDate: "", endDate: "", budget: "", status: "active" };

export default function ProjectsPage() {
  const [rows, setRows] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try { const d = await api<{ projects: Project[] }>("/api/management/projects"); setRows(d.projects); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
  }, []);
  useEffect(() => {
    void load();
    api<{ contacts: Customer[] }>("/api/contacts?type=customer").then((d) => setCustomers(d.contacts)).catch(() => setCustomers([]));
  }, [load]);

  function openNew() { setEditId(null); setForm({ ...empty }); }
  function openEdit(p: Project) {
    setEditId(p._id);
    setForm({ name: p.name, customerId: p.customerId ?? "", startDate: p.startDate ?? "", endDate: p.endDate ?? "", budget: String(p.budget), status: p.status });
  }

  async function save() {
    if (!form || !form.name.trim()) { setError("Project name is required."); return; }
    setBusy(true);
    try {
      const json = { name: form.name, customerId: form.customerId || null, startDate: form.startDate, endDate: form.endDate, budget: Number(form.budget) || 0, status: form.status };
      if (editId) await api("/api/management/projects", { method: "PATCH", json: { id: editId, ...json } });
      else await api("/api/management/projects", { method: "POST", json });
      toast.success("Saved.");
      setForm(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" subtitle="Project accounting: tag revenue and costs to a project to report profitability. Optional — not required for simple businesses." />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={openNew}>+ New project</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Code</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Dates</th><th className="px-4 py-3 text-right">Budget</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No projects yet.</td></tr>}
            {rows.map((p) => (
              <tr key={p._id}>
                <td className="px-4 py-3 font-mono text-slate-500">{p.code}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-600">{p.customerName ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{p.startDate ?? "—"} → {p.endDate ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtKsh(p.budget)}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-right"><button className="btn-secondary btn-xs" onClick={() => openEdit(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={editId ? "Edit project" : "New project"} onClose={() => setForm(null)}>
          <div className="space-y-3">
            <div><label className="label">Project name</label><input className={inputCls()} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Customer</label>
                <select className={inputCls()} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                  <option value="">— none —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className={inputCls()} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Start date</label><input type="date" className={inputCls()} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><label className="label">End date</label><input type="date" className={inputCls()} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
              <div><label className="label">Budget</label><input type="number" className={inputCls()} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
