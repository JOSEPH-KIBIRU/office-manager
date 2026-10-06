"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, Modal, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface CostCentre { _id: string; code: string; name: string; type: string; active: boolean; }

const TYPES = [
  { value: "branch", label: "Branch" },
  { value: "department", label: "Department" },
  { value: "location", label: "Location" },
  { value: "cost_centre", label: "Cost centre" },
];
const empty = { name: "", type: "department", code: "" };

export default function CostCentresPage() {
  const [rows, setRows] = useState<CostCentre[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try { const d = await api<{ costCentres: CostCentre[] }>("/api/management/cost-centres"); setRows(d.costCentres); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!form || !form.name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    try {
      await api("/api/management/cost-centres", { method: "POST", json: form });
      toast.success("Cost centre created.");
      setForm(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function toggle(r: CostCentre) {
    try { await api("/api/management/cost-centres", { method: "PATCH", json: { id: r._id, active: !r.active } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  const label = (t: string) => TYPES.find((x) => x.value === t)?.label ?? t;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cost centres"
        subtitle="Branches, departments, locations and cost centres. Tag transactions to them to report P&L by dimension — balances are never duplicated."
      />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setForm({ ...empty })}>+ New cost centre</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Active</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No cost centres yet — optional for single-location businesses.</td></tr>}
            {rows.map((r) => (
              <tr key={r._id} className={r.active ? "" : "opacity-50"}>
                <td className="px-4 py-3 font-mono text-slate-500">{r.code}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                <td className="px-4 py-3 text-slate-600">{label(r.type)}</td>
                <td className="px-4 py-3">{r.active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right"><button className="btn-secondary btn-xs" onClick={() => toggle(r)}>{r.active ? "Deactivate" : "Activate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title="New cost centre" onClose={() => setForm(null)}>
          <div className="space-y-3">
            <div><label className="label">Name</label><input className={inputCls()} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select className={inputCls()} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label className="label">Code (optional)</label><input className={inputCls()} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Create"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
