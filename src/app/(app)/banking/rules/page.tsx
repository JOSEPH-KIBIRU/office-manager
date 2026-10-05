"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, Modal, ConfirmDialog, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Rule {
  _id: string;
  name: string;
  matchField: string;
  matchType: string;
  matchValue: string;
  suggestAccountCode: string;
  suggestType: string | null;
  autoPost: boolean;
  active: boolean;
}
interface Account { code: string; name: string; isCash: boolean; active: boolean; }

const empty = { name: "", matchField: "description", matchType: "contains", matchValue: "", suggestAccountCode: "", suggestType: "", autoPost: false };

export default function BankRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [chart, setChart] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteFor, setDeleteFor] = useState<Rule | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await api<{ rules: Rule[] }>("/api/banking/rules");
      setRules(d.rules);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load rules"); }
  }, []);

  useEffect(() => {
    void load();
    api<{ accounts: Account[] }>("/api/accounting/chart")
      .then((d) => setChart(d.accounts.filter((a) => a.active && !a.isCash)))
      .catch(() => setChart([]));
  }, [load]);

  async function save() {
    if (!form) return;
    if (!form.name.trim() || !form.matchValue.trim() || !form.suggestAccountCode) {
      setError("Name, match value and suggested account are required.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/banking/rules", { method: "POST", json: form });
      toast.success("Rule created.");
      setForm(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); }
    finally { setBusy(false); }
  }

  async function toggle(r: Rule, patch: { active?: boolean; autoPost?: boolean }) {
    try {
      await api(`/api/banking/rules/${r._id}`, { method: "PATCH", json: patch });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function doDelete() {
    if (!deleteFor) return;
    setBusy(true);
    try {
      await api(`/api/banking/rules/${deleteFor._id}`, { method: "DELETE" });
      setDeleteFor(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank rules"
        subtitle="Suggest a classification when a description matches. Auto-posting is off unless the company explicitly enables it."
      />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setForm({ ...empty })}>+ New rule</button>
      </div>

      {rules.length === 0 ? (
        <p className="card p-6 text-sm text-slate-400">No rules yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Rule</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Suggest</th>
                <th className="px-4 py-3">Auto-post</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((r) => (
                <tr key={r._id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.matchField} {r.matchType.replace("_", " ")} “{r.matchValue}”
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{r.suggestAccountCode}</td>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={r.autoPost} onChange={(e) => toggle(r, { autoPost: e.target.checked })} />
                  </td>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={r.active} onChange={(e) => toggle(r, { active: e.target.checked })} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-secondary btn-xs text-red-600" onClick={() => setDeleteFor(r)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title="New bank rule" onClose={() => setForm(null)}>
          <div className="space-y-3">
            <div><label className="label">Rule name</label><input className={inputCls()} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Field</label>
                <select className={inputCls()} value={form.matchField} onChange={(e) => setForm({ ...form, matchField: e.target.value })}>
                  <option value="description">Description</option>
                  <option value="reference">Reference</option>
                </select>
              </div>
              <div>
                <label className="label">Match</label>
                <select className={inputCls()} value={form.matchType} onChange={(e) => setForm({ ...form, matchType: e.target.value })}>
                  <option value="contains">contains</option>
                  <option value="equals">equals</option>
                  <option value="starts_with">starts with</option>
                </select>
              </div>
              <div><label className="label">Value</label><input className={inputCls()} value={form.matchValue} onChange={(e) => setForm({ ...form, matchValue: e.target.value })} /></div>
            </div>
            <div>
              <label className="label">Suggest account</label>
              <select className={inputCls()} value={form.suggestAccountCode} onChange={(e) => setForm({ ...form, suggestAccountCode: e.target.value })}>
                <option value="">Select…</option>
                {chart.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.autoPost} onChange={(e) => setForm({ ...form, autoPost: e.target.checked })} />
              Enable automatic posting (otherwise suggestions only)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Create rule"}</button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteFor !== null}
        title="Delete rule"
        message={<>Delete <strong>{deleteFor?.name}</strong>?</>}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setDeleteFor(null)}
      />
    </div>
  );
}
