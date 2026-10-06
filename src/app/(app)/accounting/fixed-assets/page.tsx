"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, Modal, StatusBadge, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface FixedAsset {
  id: string; tag: string; name: string; category: string | null; purchaseDate: string;
  purchaseCost: number; supplierName: string | null; location: string | null; custodian: string | null;
  usefulLifeYears: number; residualValue: number; accumulatedDepreciation: number; netBookValue: number;
  status: string; assetAccountCode: string; accumDepAccountCode: string; depExpenseAccountCode: string;
}

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const empty = { name: "", category: "", purchaseDate: today(), purchaseCost: "", usefulLifeYears: "", residualValue: "", location: "", custodian: "", vatRate: "16", payFrom: "ap" as "ap" | "bank" | "cash" };

export default function FixedAssetsPage() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [busy, setBusy] = useState(false);
  const [disposeFor, setDisposeFor] = useState<FixedAsset | null>(null);
  const [disposeDate, setDisposeDate] = useState(today());
  const [disposeProceeds, setDisposeProceeds] = useState("");
  const [period, setPeriod] = useState(thisMonth());
  const [capitaliseFor, setCapitaliseFor] = useState<FixedAsset | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await api<{ assets: FixedAsset[] }>("/api/accounting/fixed-assets");
      setAssets(d.assets);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load assets"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = assets.reduce(
    (a, x) => ({ cost: a.cost + x.purchaseCost, accum: a.accum + x.accumulatedDepreciation, nbv: a.nbv + x.netBookValue }),
    { cost: 0, accum: 0, nbv: 0 }
  );

  async function save() {
    if (!form) return;
    if (!form.name.trim() || !form.purchaseCost || !form.usefulLifeYears) { setError("Name, cost and useful life are required."); return; }
    setBusy(true);
    try {
      const res = await api<{ id: string }>("/api/accounting/fixed-assets", {
        method: "POST",
        json: {
          name: form.name, category: form.category, purchaseDate: form.purchaseDate,
          purchaseCost: Number(form.purchaseCost), usefulLifeYears: Number(form.usefulLifeYears),
          residualValue: form.residualValue === "" ? 0 : Number(form.residualValue),
          location: form.location, custodian: form.custodian,
        },
      });
      // Capitalise immediately (records the purchase).
      await api(`/api/accounting/fixed-assets/${res.id}/capitalise`, {
        method: "POST",
        json: { date: form.purchaseDate, payFrom: form.payFrom, vatRate: Number(form.vatRate) || 0 },
      });
      toast.success("Asset registered and capitalised.");
      setForm(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); }
    finally { setBusy(false); }
  }

  async function capitalise(a: FixedAsset) {
    setBusy(true);
    try {
      await api(`/api/accounting/fixed-assets/${a.id}/capitalise`, { method: "POST", json: { date: a.purchaseDate, payFrom: "ap", vatRate: 0 } });
      toast.success("Capitalised.");
      setCapitaliseFor(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function runDepreciation() {
    setBusy(true);
    try {
      const res = await api<{ posted: number; total: number }>("/api/accounting/fixed-assets/depreciation", { method: "POST", json: { period } });
      toast.success(`Depreciation posted for ${res.posted} asset(s), ${fmtKsh(res.total)}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to run depreciation"); }
    finally { setBusy(false); }
  }

  async function doDispose() {
    if (!disposeFor) return;
    setBusy(true);
    try {
      const res = await api<{ gain: number }>(`/api/accounting/fixed-assets/${disposeFor.id}/dispose`, {
        method: "POST",
        json: { date: disposeDate, proceeds: Number(disposeProceeds) || 0 },
      });
      toast.success(`Disposed. ${res.gain >= 0 ? "Gain" : "Loss"} on disposal: ${fmtKsh(Math.abs(res.gain))}.`);
      setDisposeFor(null); setDisposeProceeds("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to dispose"); }
    finally { setBusy(false); }
  }

  async function setStatus(a: FixedAsset, status: string) {
    try { await api(`/api/accounting/fixed-assets/${a.id}`, { method: "PATCH", json: { status } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Fixed assets" subtitle="Asset register with straight-line depreciation, capitalisation and disposal — all posted through the ledger." />
      {error && <Alert kind="error">{error}</Alert>}

      <div className="grid grid-cols-3 gap-4">
        {[{ l: "Total cost", v: totals.cost }, { l: "Accumulated depreciation", v: totals.accum }, { l: "Net book value", v: totals.nbv }].map((c) => (
          <div key={c.l} className="card p-4"><p className="text-xs font-medium text-slate-500">{c.l}</p><p className="mt-1 text-xl font-bold text-slate-900">{fmtKsh(c.v)}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-[10rem]" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" />
        <button className="btn-secondary" onClick={runDepreciation} disabled={busy}>Run depreciation</button>
        <button className="btn-primary ml-auto" onClick={() => setForm({ ...empty })}>+ New asset</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Tag</th><th className="px-4 py-3">Asset</th><th className="px-4 py-3">Purchased</th>
              <th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-right">Accum. dep</th>
              <th className="px-4 py-3 text-right">NBV</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assets.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No fixed assets yet.</td></tr>}
            {assets.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-mono text-slate-500">{a.tag}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{a.name}{a.category && <span className="block text-xs text-slate-400">{a.category}</span>}</td>
                <td className="px-4 py-3 text-slate-500">{a.purchaseDate}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtKsh(a.purchaseCost)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtKsh(a.accumulatedDepreciation)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtKsh(a.netBookValue)}</td>
                <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {a.status === "draft" && <button className="btn-primary btn-xs" onClick={() => setCapitaliseFor(a)} disabled={busy}>Capitalise</button>}
                    {a.status === "active" && <button className="btn-secondary btn-xs" onClick={() => { setDisposeFor(a); setDisposeDate(today()); }}>Dispose</button>}
                    {a.status !== "disposed" && a.status !== "archived" && <button className="btn-secondary btn-xs" onClick={() => setStatus(a, "archived")}>Archive</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title="New fixed asset" onClose={() => setForm(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Asset name</label><input className={inputCls()} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">Category</label><input className={inputCls()} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Purchase date</label><input type="date" className={inputCls()} value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></div>
              <div><label className="label">Cost</label><input type="number" className={inputCls()} value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} /></div>
              <div><label className="label">Residual value</label><input type="number" className={inputCls()} value={form.residualValue} onChange={(e) => setForm({ ...form, residualValue: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Useful life (years)</label><input type="number" className={inputCls()} value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} /></div>
              <div><label className="label">VAT %</label><input type="number" className={inputCls()} value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })} /></div>
              <div>
                <label className="label">Paid from</label>
                <select className={inputCls()} value={form.payFrom} onChange={(e) => setForm({ ...form, payFrom: e.target.value as never })}>
                  <option value="ap">Accounts payable</option><option value="bank">Bank</option><option value="cash">Cash</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Location</label><input className={inputCls()} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div><label className="label">Custodian</label><input className={inputCls()} value={form.custodian} onChange={(e) => setForm({ ...form, custodian: e.target.value })} /></div>
            </div>
            <p className="text-xs text-slate-400">Depreciation method: straight-line. The purchase is posted immediately (Dr Fixed asset, Dr Input VAT, Cr AP/Bank).</p>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Register & capitalise"}</button>
            </div>
          </div>
        </Modal>
      )}

      {capitaliseFor && (
        <Modal title={`Capitalise ${capitaliseFor.name}`} onClose={() => setCapitaliseFor(null)}>
          <p className="text-sm text-slate-600">Post the purchase entry? Dr Fixed asset {capitaliseFor.assetAccountCode} · Cr Accounts payable.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setCapitaliseFor(null)} disabled={busy}>Cancel</button>
            <button className="btn-primary" onClick={() => capitalise(capitaliseFor)} disabled={busy}>Post purchase</button>
          </div>
        </Modal>
      )}

      {disposeFor && (
        <Modal title={`Dispose ${disposeFor.name}`} onClose={() => setDisposeFor(null)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Net book value: <strong>{fmtKsh(disposeFor.netBookValue)}</strong></p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Disposal date</label><input type="date" className={inputCls()} value={disposeDate} onChange={(e) => setDisposeDate(e.target.value)} /></div>
              <div><label className="label">Sale proceeds</label><input type="number" className={inputCls()} value={disposeProceeds} onChange={(e) => setDisposeProceeds(e.target.value)} /></div>
            </div>
            <p className="text-xs text-slate-400">Gain or loss on disposal is calculated automatically and posted to Other income / General expenses.</p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setDisposeFor(null)} disabled={busy}>Cancel</button>
              <button className="btn-danger" onClick={doDispose} disabled={busy}>{busy ? "Posting…" : "Dispose asset"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
