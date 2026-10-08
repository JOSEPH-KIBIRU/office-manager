"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { PageHeader, Alert, api, inputCls } from "@/components/ui";

interface Report { title: string; headers: string[]; rows: (string | number)[][]; note?: string; }

const REPORTS = [
  { id: "trial", label: "Trial balance" },
  { id: "pnl", label: "Profit & loss" },
  { id: "bs", label: "Balance sheet" },
  { id: "cashflow", label: "Cash flow statement" },
  { id: "ar-aging", label: "Accounts receivable aging" },
  { id: "ap-aging", label: "Accounts payable aging" },
  { id: "expense-analysis", label: "Expense analysis" },
  { id: "revenue-analysis", label: "Revenue analysis" },
  { id: "depreciation", label: "Depreciation schedule" },
  { id: "budget", label: "Budget vs actual" },
  { id: "tax", label: "Tax summary" },
  { id: "journals", label: "Journal report" },
  { id: "fixed-assets", label: "Fixed asset register" },
] as const;
type ReportId = (typeof REPORTS)[number]["id"];

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;

export default function ReportsHubPage() {
  const [type, setType] = useState<ReportId>("trial");
  const [from, setFrom] = useState(yearStart());
  const [through, setThrough] = useState(today());
  const [cc, setCc] = useState("");
  const [prj, setPrj] = useState("");
  const [costCentres, setCostCentres] = useState<{ code: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ _id: string; name: string }[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ costCentres: { code: string; name: string }[] }>("/api/management/cost-centres").then((d) => setCostCentres(d.costCentres ?? [])).catch(() => setCostCentres([]));
    api<{ projects: { _id: string; name: string }[] }>("/api/management/projects").then((d) => setProjects(d.projects ?? [])).catch(() => setProjects([]));
  }, []);

  const dimQuery = `${cc ? `&costCenterCode=${cc}` : ""}${prj ? `&projectId=${prj}` : ""}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await buildReport(type, from, through, dimQuery));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [type, from, through, dimQuery]);

  useEffect(() => { void load(); }, [load]);

  const exportName = report ? `${type}-${through}` : type;

  function toCsv() {
    if (!report) return;
    const lines = [report.headers.join(","), ...report.rows.map((r) => r.map(csvCell).join(","))];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${exportName}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
  function toExcel() {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([report.headers, ...report.rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${exportName}.xlsx`);
  }
  function toPdf() { window.print(); }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Financial statements and management reports — all derived from the General Ledger." action={
        <div className="no-print flex gap-2">
          <button className="btn-secondary text-xs" onClick={toCsv} disabled={!report}>CSV</button>
          <button className="btn-secondary text-xs" onClick={toExcel} disabled={!report}>Excel</button>
          <button className="btn-secondary text-xs" onClick={toPdf} disabled={!report}>Print / PDF</button>
        </div>
      } />
      {error && <Alert kind="error">{error}</Alert>}

      <div className="card no-print flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Report</label>
          <select className={inputCls()} value={type} onChange={(e) => setType(e.target.value as ReportId)}>
            {REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div><label className="label">From</label><input type="date" className={inputCls()} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">Through</label><input type="date" className={inputCls()} value={through} onChange={(e) => setThrough(e.target.value)} /></div>
        <div>
          <label className="label">Cost centre</label>
          <select className={inputCls()} value={cc} onChange={(e) => setCc(e.target.value)}>
            <option value="">All</option>
            {costCentres.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Project</label>
          <select className={inputCls()} value={prj} onChange={(e) => setPrj(e.target.value)}>
            <option value="">All</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : report && (
        <div className="card overflow-x-auto report-print">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-bold text-slate-900">{report.title}</h2>
            <p className="text-xs text-slate-500">
              {from} → {through}
              {cc ? ` · cost centre ${cc}` : ""}{prj ? ` · project ${prj}` : ""}
              {report.note ? ` · ${report.note}` : ""}
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                {report.headers.map((h, i) => <th key={i} className={`px-4 py-2 ${i === 0 ? "" : "text-right"}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rows.length === 0 ? (
                <tr><td colSpan={report.headers.length} className="px-4 py-6 text-center text-slate-400">No data.</td></tr>
              ) : report.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => <td key={j} className={`px-4 py-2 ${j === 0 ? "text-slate-700" : "text-right tabular-nums text-slate-600"}`}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function csvCell(v: string | number) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const money = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface AccountRow { code: string; name: string; amount: number; group?: string; }

async function buildReport(type: ReportId, from: string, through: string, dim: string): Promise<Report> {
  if (type === "trial") {
    const d = await api<{ data: { rows: { code: string; name: string; debit: number; credit: number }[]; debitTotal: number; creditTotal: number } }>(`/api/accounting/reports?type=trial&through=${through}${dim}`);
    return { title: "Trial balance", headers: ["Code", "Account", "Debit", "Credit"], rows: [
      ...d.data.rows.map((r) => [r.code, r.name, money(r.debit), money(r.credit)]),
      ["", "Totals", money(d.data.debitTotal), money(d.data.creditTotal)],
    ] };
  }
  if (type === "pnl") {
    const d = await api<{ data: { income: AccountRow[]; costOfSales: AccountRow[]; expense: AccountRow[]; incomeTotal: number; costOfSalesTotal: number; grossProfit: number; expenseTotal: number; profit: number } }>(`/api/accounting/reports?type=pnl&from=${from}&through=${through}${dim}`);
    const rows: (string | number)[][] = [];
    for (const r of d.data.income) rows.push(["Revenue", r.name, money(r.amount)]);
    rows.push(["", "Total revenue", money(d.data.incomeTotal)]);
    for (const r of d.data.costOfSales) rows.push(["Cost of sales", r.name, money(r.amount)]);
    rows.push(["", "Gross profit", money(d.data.grossProfit)]);
    for (const r of d.data.expense) rows.push(["Expense", r.name, money(r.amount)]);
    rows.push(["", d.data.profit >= 0 ? "Profit" : "Loss", money(Math.abs(d.data.profit))]);
    return { title: "Profit & loss", headers: ["Section", "Account", "Amount"], rows };
  }
  if (type === "bs") {
    const d = await api<{ data: { assets: AccountRow[]; liabilities: AccountRow[]; equity: AccountRow[]; currentYear: number; assetTotal: number; liabTotal: number; equityTotal: number; balanced: boolean } }>(`/api/accounting/reports?type=bs&through=${through}${dim}`);
    const rows: (string | number)[][] = [];
    for (const r of d.data.assets) rows.push(["Asset", r.name, money(r.amount)]);
    rows.push(["", "Total assets", money(d.data.assetTotal)]);
    // Statutory deductions (PAYE, NSSF, SHIF, Housing, HELB…) are collapsed into
    // one presentation line; the underlying accounts remain separate on the GL.
    let statutory = 0;
    for (const r of d.data.liabilities) {
      if ((r.group ?? "") === "Statutory") {
        statutory += r.amount;
        continue;
      }
      rows.push(["Liability", r.name, money(r.amount)]);
    }
    if (statutory !== 0) {
      rows.push(["Liability", "Statutory deductions (PAYE, NSSF, SHIF, Housing, HELB…)", money(statutory)]);
    }
    rows.push(["", "Total liabilities", money(d.data.liabTotal)]);
    for (const r of d.data.equity) rows.push(["Equity", r.name, money(r.amount)]);
    rows.push(["", "Accumulated result", money(d.data.currentYear)]);
    rows.push(["", "Liabilities + equity", money(d.data.liabTotal + d.data.equityTotal)]);
    return { title: "Balance sheet", headers: ["Section", "Account", "Amount"], rows, note: d.data.balanced ? "balances" : "does not balance" };
  }
  if (type === "cashflow") {
    const d = await api<{ opening: number; operating: number; investing: number; financing: number; net: number; closing: number }>(`/api/management/reports?type=cash-flow&from=${from}&through=${through}`);
    return { title: "Cash flow statement", headers: ["Section", "Amount"], rows: [
      ["Opening cash", money(d.opening)],
      ["Net operating cash flow", money(d.operating)],
      ["Net investing cash flow", money(d.investing)],
      ["Net financing cash flow", money(d.financing)],
      ["Net movement", money(d.net)],
      ["Closing cash", money(d.closing)],
    ] };
  }
  if (type === "ar-aging" || type === "ap-aging") {
    const isAr = type === "ar-aging";
    const d = await api<{ rows: any[]; totals: any }>(`/api/accounting/aging?type=${isAr ? "ar" : "ap"}`);
    return { title: isAr ? "Accounts receivable aging" : "Accounts payable aging", headers: ["Contact", "Current", "1–30", "31–60", "61–90", "90+", "Total"], rows: [
      ...d.rows.map((r) => [r.contactName, money(r.current), money(r.d1_30), money(r.d31_60), money(r.d61_90), money(r.d90plus), money(r.total)]),
      ["Totals", money(d.totals.current), money(d.totals.d1_30), money(d.totals.d31_60), money(d.totals.d61_90), money(d.totals.d90plus), money(d.totals.total)],
    ] };
  }
  if (type === "expense-analysis" || type === "revenue-analysis") {
    const d = await api<{ rows: AccountRow[]; total: number }>(`/api/management/reports?type=${type}&from=${from}&through=${through}${dim}`);
    return { title: type === "expense-analysis" ? "Expense analysis" : "Revenue analysis", headers: ["Code", "Account", "Amount"], rows: [
      ...d.rows.map((r) => [r.code, r.name, money(r.amount)]),
      ["", "Total", money(d.total)],
    ] };
  }
  if (type === "depreciation") {
    const d = await api<{ rows: { date: string; description: string; ref: string; amount: number }[]; total: number }>(`/api/management/reports?type=depreciation-schedule&from=${from}&through=${through}`);
    return { title: "Depreciation schedule", headers: ["Date", "Description", "Ref", "Amount"], rows: [
      ...d.rows.map((r) => [r.date, r.description, r.ref, money(r.amount)]),
      ["", "Total", "", money(d.total)],
    ] };
  }
  if (type === "budget") {
    const d = await api<{ rows: any[]; totals: { budget: number; actual: number; variance: number } }>(`/api/management/reports?type=budget-vs-actual&from=${from}&through=${through}`);
    return { title: "Budget vs actual", headers: ["Period", "Account", "Dimension", "Budget", "Actual", "Variance", "Var %"], rows: [
      ...d.rows.map((r) => [r.period, r.accountName, r.dimension, money(r.budget), money(r.actual), money(r.variance), r.variancePct !== null ? `${r.variancePct}%` : "—"]),
      ["", "Totals", "", money(d.totals.budget), money(d.totals.actual), money(d.totals.variance), ""],
    ] };
  }
  if (type === "tax") {
    const d = await api<{ rows: AccountRow[]; total: number }>(`/api/accounting/tax-report?type=summary&from=${from}&through=${through}`);
    return { title: "Tax summary (statutory liabilities)", headers: ["Code", "Account", "Amount"], rows: [
      ...d.rows.map((r) => [r.code, r.name, money(r.amount)]),
      ["", "Total", money(d.total)],
    ] };
  }
  if (type === "journals") {
    const d = await api<{ journals: any[] }>(`/api/accounting/ledger?from=${from}&through=${through}`);
    const rows: (string | number)[][] = [];
    for (const j of d.journals) for (const l of j.lines) rows.push([j.ref, j.date, j.description, l.accountCode, money(l.debit), money(l.credit)]);
    return { title: "Journal report", headers: ["Ref", "Date", "Description", "Account", "Debit", "Credit"], rows, note: `${d.journals.length} journal(s)` };
  }
  // fixed-assets
  const d = await api<{ assets: any[] }>(`/api/accounting/fixed-assets`);
  return { title: "Fixed asset register", headers: ["Tag", "Asset", "Cost", "Accum. dep", "NBV", "Status"], rows: d.assets.map((a) => [a.tag, a.name, money(a.purchaseCost), money(a.accumulatedDepreciation), money(a.netBookValue), a.status]) };
}
