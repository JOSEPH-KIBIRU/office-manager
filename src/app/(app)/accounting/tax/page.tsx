"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, Modal, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface TaxConfig {
  _id: string;
  code: string;
  name: string;
  rate: number;
  effectiveDate: string;
  inputAccountCode: string | null;
  outputAccountCode: string | null;
  liabilityAccountCode: string | null;
  active: boolean;
  notes: string | null;
}
interface Account { code: string; name: string; isCash: boolean; active: boolean; }
interface VatReport { taxableSales: number; outputVat: number; taxablePurchases: number; inputVat: number; adjustments: number; netVatPayable: number; }
interface TaxRow { code: string; name: string; amount: number; }

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const empty = { code: "", name: "", rate: "", effectiveDate: today(), inputAccountCode: "", outputAccountCode: "", liabilityAccountCode: "", active: true, notes: "" };

export default function TaxPage() {
  const [configs, setConfigs] = useState<TaxConfig[]>([]);
  const [chart, setChart] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(yearStart());
  const [through, setThrough] = useState(today());
  const [vat, setVat] = useState<VatReport | null>(null);
  const [summary, setSummary] = useState<{ rows: TaxRow[]; total: number } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await api<{ configs: TaxConfig[] }>("/api/accounting/tax-configs");
      setConfigs(d.configs);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load tax config"); }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const [v, s] = await Promise.all([
        api<VatReport>(`/api/accounting/tax-report?type=vat&from=${from}&through=${through}`),
        api<{ rows: TaxRow[]; total: number }>(`/api/accounting/tax-report?type=summary&from=${from}&through=${through}`),
      ]);
      setVat(v);
      setSummary(s);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load tax reports"); }
  }, [from, through]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { api<{ accounts: Account[] }>("/api/accounting/chart").then((d) => setChart(d.accounts)).catch(() => setChart([])); }, []);
  useEffect(() => { void loadReports(); }, [loadReports]);

  function openEdit(c: TaxConfig) {
    setForm({
      code: c.code, name: c.name, rate: String(c.rate), effectiveDate: c.effectiveDate,
      inputAccountCode: c.inputAccountCode ?? "", outputAccountCode: c.outputAccountCode ?? "",
      liabilityAccountCode: c.liabilityAccountCode ?? "", active: c.active, notes: c.notes ?? "",
    });
  }

  async function seed() {
    setBusy(true);
    try { await api("/api/accounting/tax-configs", { method: "POST", json: { action: "seed" } }); toast.success("Default tax codes loaded."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!form) return;
    if (!form.code.trim() || !form.name.trim()) { setError("Code and name are required."); return; }
    setBusy(true);
    try {
      await api("/api/accounting/tax-configs", { method: "POST", json: { ...form, rate: Number(form.rate) || 0 } });
      toast.success("Tax config saved.");
      setForm(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function toggle(c: TaxConfig) {
    try { await api("/api/accounting/tax-configs", { method: "PATCH", json: { code: c.code, active: !c.active } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax configuration & VAT"
        subtitle="Configurable tax codes (VAT, PAYE, NSSF, SHIF, Housing Levy, HELB, WHT). Reports derive from the General Ledger — no separate tax balances."
        action={<button className="btn-secondary text-xs" onClick={seed} disabled={busy}>Load default taxes</button>}
      />
      {error && <Alert kind="error">{error}</Alert>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3">Effective</th><th className="px-4 py-3">Accounts</th><th className="px-4 py-3">Active</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {configs.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No tax codes yet — click “Load default taxes”.</td></tr>}
            {configs.map((c) => (
              <tr key={c.code} className={c.active ? "" : "opacity-50"}>
                <td className="px-4 py-3 font-mono text-slate-600">{c.code}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.rate}%</td>
                <td className="px-4 py-3 text-slate-500">{c.effectiveDate}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {c.inputAccountCode && <span className="mr-2">in {c.inputAccountCode}</span>}
                  {c.outputAccountCode && <span className="mr-2">out {c.outputAccountCode}</span>}
                  {c.liabilityAccountCode && <span>liab {c.liabilityAccountCode}</span>}
                </td>
                <td className="px-4 py-3">{c.active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <button className="btn-secondary btn-xs mr-1" onClick={() => openEdit(c)}>Edit</button>
                  <button className="btn-secondary btn-xs" onClick={() => toggle(c)}>{c.active ? "Disable" : "Enable"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div><label className="label">From</label><input type="date" className={inputCls()} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">Through</label><input type="date" className={inputCls()} value={through} onChange={(e) => setThrough(e.target.value)} /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">VAT report (from the ledger)</h3>
          {vat && (
            <div className="space-y-1 text-sm">
              <Row label="Taxable sales" value={vat.taxableSales} />
              <Row label="Output VAT" value={vat.outputVat} />
              <Row label="Taxable purchases" value={vat.taxablePurchases} />
              <Row label="Input VAT" value={vat.inputVat} />
              <Row label="Adjustments" value={vat.adjustments} />
              <div className="mt-2 border-t border-slate-200 pt-2">
                <Row label="Net VAT payable" value={vat.netVatPayable} bold />
              </div>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Statutory liabilities (from the ledger)</h3>
          {summary && summary.rows.length === 0 && <p className="text-sm text-slate-400">No statutory balances in this period.</p>}
          {summary && summary.rows.map((r) => <Row key={r.code} label={`${r.code} · ${r.name}`} value={r.amount} />)}
          {summary && summary.rows.length > 0 && (
            <div className="mt-2 border-t border-slate-200 pt-2"><Row label="Total" value={summary.total} bold /></div>
          )}
        </div>
      </div>

      {form && (
        <Modal title={form.code ? `Edit ${form.code}` : "New tax code"} onClose={() => setForm(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Code</label><input className={inputCls()} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!configs.find((c) => c.code === form.code)} /></div>
              <div><label className="label">Name</label><input className={inputCls()} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Rate (%)</label><input type="number" step="0.001" className={inputCls()} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
              <div><label className="label">Effective date</label><input type="date" className={inputCls()} value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Input account</label>
                <select className={inputCls()} value={form.inputAccountCode} onChange={(e) => setForm({ ...form, inputAccountCode: e.target.value })}>
                  <option value="">—</option>
                  {chart.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Output account</label>
                <select className={inputCls()} value={form.outputAccountCode} onChange={(e) => setForm({ ...form, outputAccountCode: e.target.value })}>
                  <option value="">—</option>
                  {chart.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Liability account</label>
                <select className={inputCls()} value={form.liabilityAccountCode} onChange={(e) => setForm({ ...form, liabilityAccountCode: e.target.value })}>
                  <option value="">—</option>
                  {chart.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save tax code"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? "font-semibold" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums text-slate-800">{fmtKsh(value)}</span>
    </div>
  );
}
