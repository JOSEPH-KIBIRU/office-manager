"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface DimRow { key: string; label: string; revenue: number; cost: number; profit: number; }
interface BvaRow { id: string; period: string; accountName: string; dimension: string; budget: number; actual: number; variance: number; variancePct: number | null; }
interface ProjRow { id: string; code: string; name: string; customerName: string | null; status: string; budget: number; revenue: number; directCosts: number; grossProfit: number; grossMargin: number | null; }
interface Account { code: string; name: string; isCash: boolean; active: boolean; }
interface Req { accountCode: string; accountName: string; requireCostCentre: boolean; requireProject: boolean; }

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;

type Tab = "cost_centre" | "project" | "bva" | "profitability" | "rules";

export default function ManagementReportsPage() {
  const [tab, setTab] = useState<Tab>("cost_centre");
  const [from, setFrom] = useState(yearStart());
  const [through, setThrough] = useState(today());
  const [dim, setDim] = useState<{ rows: DimRow[]; totals: { revenue: number; cost: number; profit: number } } | null>(null);
  const [bva, setBva] = useState<{ rows: BvaRow[]; totals: { budget: number; actual: number; variance: number } } | null>(null);
  const [proj, setProj] = useState<{ rows: ProjRow[]; totals: { revenue: number; directCosts: number; grossProfit: number } } | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [chart, setChart] = useState<Account[]>([]);
  const [ruleAccount, setRuleAccount] = useState("");
  const [ruleCC, setRuleCC] = useState(false);
  const [rulePrj, setRulePrj] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const loadReport = useCallback(async () => {
    setError(null);
    try {
      if (tab === "cost_centre" || tab === "project") {
        const d = await api<{ rows: DimRow[]; totals: { revenue: number; cost: number; profit: number } }>(
          `/api/management/reports?type=pnl-by-dimension&dimension=${tab}&from=${from}&through=${through}`
        );
        setDim(d);
      } else if (tab === "bva") {
        const d = await api<{ rows: BvaRow[]; totals: { budget: number; actual: number; variance: number } }>(
          `/api/management/reports?type=budget-vs-actual&from=${from}&through=${through}`
        );
        setBva(d);
      } else if (tab === "profitability") {
        const d = await api<{ rows: ProjRow[]; totals: { revenue: number; directCosts: number; grossProfit: number } }>(
          `/api/management/reports?type=project-profitability&from=${from}&through=${through}`
        );
        setProj(d);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load report"); }
  }, [tab, from, through]);

  const loadRules = useCallback(async () => {
    try {
      const d = await api<{ requirements: Req[] }>("/api/management/dimension-requirements");
      setReqs(d.requirements);
      const c = await api<{ accounts: Account[] }>("/api/accounting/chart");
      setChart(c.accounts.filter((a) => a.active && !a.isCash));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (tab !== "rules") void loadReport(); }, [tab, from, through, loadReport]);
  useEffect(() => { if (tab === "rules") void loadRules(); }, [tab, loadRules]);

  async function saveRule() {
    if (!ruleAccount) { setError("Select an account."); return; }
    try {
      await api("/api/management/dimension-requirements", { method: "POST", json: { accountCode: ruleAccount, requireCostCentre: ruleCC, requireProject: rulePrj } });
      toast.success("Dimension rule saved.");
      setRuleAccount(""); setRuleCC(false); setRulePrj(false);
      await loadRules();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Management reports" subtitle="P&L by dimension, budget vs actual and project profitability — all derived from the General Ledger. Tags are optional; unassigned activity is shown separately." />
      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        {([["cost_centre", "Cost centre P&L"], ["project", "Project P&L"], ["bva", "Budget vs actual"], ["profitability", "Project profitability"], ["rules", "Dimension rules"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === id ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{label}</button>
        ))}
        {tab !== "rules" && (
          <div className="ml-auto flex items-end gap-2">
            <div><label className="label">From</label><input type="date" className={inputCls()} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="label">Through</label><input type="date" className={inputCls()} value={through} onChange={(e) => setThrough(e.target.value)} /></div>
          </div>
        )}
      </div>

      {(tab === "cost_centre" || tab === "project") && (
        <ReportTable
          head={[tab === "cost_centre" ? "Cost centre" : "Project", "Revenue", "Cost", "Profit"]}
          rows={(dim?.rows ?? []).map((r) => [r.label, fmtKsh(r.revenue), fmtKsh(r.cost), fmtKsh(r.profit)])}
          totals={dim ? ["Totals", fmtKsh(dim.totals.revenue), fmtKsh(dim.totals.cost), fmtKsh(dim.totals.profit)] : undefined}
        />
      )}

      {tab === "bva" && (
        <ReportTable
          head={["Period", "Account", "Dimension", "Budget", "Actual", "Variance", "Var %"]}
          rows={(bva?.rows ?? []).map((r) => [r.period, r.accountName, r.dimension, fmtKsh(r.budget), fmtKsh(r.actual), fmtKsh(r.variance), r.variancePct !== null ? `${r.variancePct}%` : "—"])}
          totals={bva ? ["", "Totals", "", fmtKsh(bva.totals.budget), fmtKsh(bva.totals.actual), fmtKsh(bva.totals.variance), ""] : undefined}
          danger={(bva?.rows ?? []).map((r) => r.variance < 0)}
        />
      )}

      {tab === "profitability" && (
        <ReportTable
          head={["Code", "Project", "Customer", "Revenue", "Direct costs", "Gross profit", "Margin"]}
          rows={(proj?.rows ?? []).map((r) => [r.code, r.name, r.customerName ?? "—", fmtKsh(r.revenue), fmtKsh(r.directCosts), fmtKsh(r.grossProfit), r.grossMargin !== null ? `${r.grossMargin}%` : "—"])}
          totals={proj ? ["", "Totals", "", fmtKsh(proj.totals.revenue), fmtKsh(proj.totals.directCosts), fmtKsh(proj.totals.grossProfit), ""] : undefined}
        />
      )}

      {tab === "rules" && (
        <div className="space-y-4">
          <div className="card max-w-2xl p-5">
            <p className="mb-3 text-sm text-slate-600">
              Require dimensions on selected accounts for larger organisations. Enforced on manual journals (a simple
              one-location business can leave everything unset).
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Account</label>
                <select className={inputCls()} value={ruleAccount} onChange={(e) => setRuleAccount(e.target.value)}>
                  <option value="">Select…</option>
                  {chart.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </select>
              </div>
              <div className="flex gap-4 text-sm text-slate-600">
                <label className="flex items-center gap-2"><input type="checkbox" checked={ruleCC} onChange={(e) => setRuleCC(e.target.checked)} /> Require cost centre</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={rulePrj} onChange={(e) => setRulePrj(e.target.checked)} /> Require project</label>
              </div>
              <button className="btn-primary" onClick={saveRule}>Save rule</button>
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Account</th><th className="px-4 py-3">Require cost centre</th><th className="px-4 py-3">Require project</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {reqs.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No dimension rules — all optional.</td></tr>}
                {reqs.map((r) => (
                  <tr key={r.accountCode}><td className="px-4 py-3 font-medium text-slate-800">{r.accountCode} · {r.accountName}</td><td className="px-4 py-3">{r.requireCostCentre ? "Yes" : "No"}</td><td className="px-4 py-3">{r.requireProject ? "Yes" : "No"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportTable({ head, rows, totals, danger }: { head: string[]; rows: string[][]; totals?: string[]; danger?: boolean[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            {head.map((h, i) => <th key={i} className={`px-4 py-3 ${i === 0 ? "" : "text-right"}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr><td colSpan={head.length} className="px-4 py-6 text-center text-slate-400">No data for this period.</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => <td key={j} className={`px-4 py-3 ${j === 0 ? "font-medium text-slate-800" : "text-right tabular-nums"} ${danger?.[i] && j >= 3 ? "text-red-600" : "text-slate-600"}`}>{c}</td>)}
            </tr>
          ))}
          {totals && (
            <tr className="border-t-2 border-slate-900 bg-slate-50 font-semibold">
              {totals.map((c, j) => <td key={j} className={`px-4 py-3 ${j === 0 ? "text-slate-700" : "text-right tabular-nums"}`}>{c}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
