"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { PageHeader, Alert, ConfirmDialog, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

const fmtKsh = (n: number) =>
  "KES " + Math.round(n).toLocaleString("en-KE", { maximumFractionDigits: 0 });

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

/* ----------------------------- CSV export ----------------------------- */

function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Minimal RFC-4180-ish CSV parser (handles quotes, commas, newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function normalizeDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  let m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

function parseAmount(raw: string): number {
  let s = raw.trim();
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()]/g, "").replace(/[^0-9.]/g, "");
  const n = Number(s);
  if (!isFinite(n)) return NaN;
  return neg ? -n : n;
}

/**
 * Turn an arbitrary bank/M-Pesa CSV into our normalized
 * `date,description,amount,reference` lines. Detects columns by header name
 * (date/narrative/amount or debit/credit/reference); falls back to positional.
 */
function normalizeBankCsv(rows: string[][]): string[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));

  const dateIdx = find("date", "time");
  const descIdx = find("description", "narrative", "details", "particulars", "narration", "transaction");
  const amountIdx = find("amount", "value");
  const debitIdx = find("debit", "withdrawal", "paid out", "money out");
  const creditIdx = find("credit", "deposit", "paid in", "money in");
  const refIdx = find("ref", "cheque", "transaction id", "receipt");

  const hasHeader = dateIdx >= 0 && (descIdx >= 0 || amountIdx >= 0 || debitIdx >= 0 || creditIdx >= 0);
  const body = hasHeader ? rows.slice(1) : rows;

  const out: string[] = [];
  for (const r of body) {
    const date = normalizeDate(hasHeader ? r[dateIdx] ?? "" : r[0] ?? "");
    const description = (hasHeader ? r[descIdx] ?? "" : r[1] ?? "").trim();
    let amount: number;
    if (hasHeader && (debitIdx >= 0 || creditIdx >= 0)) {
      const debit = debitIdx >= 0 ? parseAmount(r[debitIdx] ?? "") : 0;
      const credit = creditIdx >= 0 ? parseAmount(r[creditIdx] ?? "") : 0;
      amount = (isFinite(credit) ? credit : 0) - (isFinite(debit) ? debit : 0);
    } else {
      amount = parseAmount(hasHeader ? r[amountIdx] ?? "" : r[2] ?? "");
    }
    const reference = (hasHeader && refIdx >= 0 ? r[refIdx] ?? "" : r[3] ?? "").trim();
    if (!date || !description || !isFinite(amount) || amount === 0) continue;
    out.push(`${date},${description.replace(/,/g, " ")},${amount},${reference.replace(/,/g, " ")}`);
  }
  return out;
}

const PDF_DATE = /(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/;

/**
 * Best-effort parser for the raw text lines extracted from a PDF statement.
 * Finds a date, then treats the last (preferably decimal) number as the amount
 * and the text in between as the description; DR/CR suffixes set the sign.
 * The user reviews the result before importing.
 */
function extractFromPdfText(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const dm = line.match(PDF_DATE);
    if (!dm) continue;
    const date = normalizeDate(dm[1]);
    if (!date) continue;
    const after = line.slice((dm.index ?? 0) + dm[0].length);
    const nums = [...after.matchAll(/-?\d[\d,]*(?:\.\d{1,2})?/g)].map((m) => m[0]);
    if (nums.length === 0) continue;
    const withDecimal = nums.filter((n) => n.includes("."));
    const amountRaw = withDecimal.length ? withDecimal[withDecimal.length - 1] : nums[nums.length - 1];
    let amount = parseAmount(amountRaw);
    if (!isFinite(amount) || amount === 0) continue;
    if (/\bDR\b/i.test(line)) amount = -Math.abs(amount);
    else if (/\bCR\b/i.test(line)) amount = Math.abs(amount);
    const firstNumIdx = after.search(/-?\d[\d,]*(?:\.\d{1,2})?/);
    let description = (firstNumIdx >= 0 ? after.slice(0, firstNumIdx) : after).trim();
    if (!description) description = "Bank transaction";
    out.push(`${date},${description.replace(/,/g, " ")},${amount},`);
  }
  return out;
}


/* ------------------------------- Types ------------------------------- */

interface AccountRow {
  code: string;
  name: string;
  type: string;
  group: string;
  isCash: boolean;
  balance: number;
}
interface Overview {
  accounts: AccountRow[];
  cash: { parts: { code: string; name: string; balance: number }[]; total: number };
  periods: { period: string; label: string; status: string; lockedAt: string | null }[];
  journalCount: number;
  trialBalanced: boolean;
  debitTotal: number;
  creditTotal: number;
}
interface LedgerLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string | null;
}
interface LedgerJournal {
  id: string;
  date: string;
  period: string;
  ref: string;
  source: string;
  description: string;
  postedByName: string | null;
  reversed: boolean;
  lines: LedgerLine[];
}
interface StatementRow {
  code: string;
  name: string;
  amount: number;
  group: string;
}
interface Trial {
  rows: { code: string; name: string; debit: number; credit: number }[];
  debitTotal: number;
  creditTotal: number;
  balanced: boolean;
}
interface Pnl {
  from: string;
  through: string;
  income: StatementRow[];
  expense: StatementRow[];
  incomeTotal: number;
  expenseTotal: number;
  profit: number;
}
interface Bs {
  through: string;
  assets: StatementRow[];
  liabilities: StatementRow[];
  equity: StatementRow[];
  currentYear: number;
  assetTotal: number;
  liabTotal: number;
  equityTotal: number;
  balanced: boolean;
}
interface BankLine {
  id: string;
  accountCode: string;
  date: string;
  description: string;
  amount: number;
  reference: string | null;
  status: "unmatched" | "matched" | "ignored";
  journalId: string | null;
}
interface InvoiceLite {
  id: string;
  number: string;
  contact_name: string;
  total: number;
}
interface VatReturn {
  period: string;
  output: number;
  input: number;
  payable: number;
  outputLines: { ref: string; date: string; description: string; amount: number }[];
  inputLines: { ref: string; date: string; description: string; amount: number }[];
}

type Tab = "ledger" | "statements" | "bank" | "vat" | "periods" | "manual";

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>("ledger");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadOverview() {
    try {
      setOverview(await api<Overview>("/api/accounting"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounting data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadOverview();
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "ledger", label: "General ledger" },
    { id: "statements", label: "Statements" },
    { id: "bank", label: "Bank & M-Pesa" },
    { id: "vat", label: "VAT" },
    { id: "periods", label: "Periods" },
    { id: "manual", label: "Manual journal" },
  ];

  const cashAccounts = (overview?.accounts ?? []).filter((a) => a.isCash);

  return (
    <>
      <PageHeader
        title="Accounting"
        subtitle="A double-entry general ledger fed automatically by invoices, bills, petty cash, car logs and payroll."
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-slate-500">Cash &amp; bank position</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{fmtKsh(overview?.cash.total ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-400">{overview?.cash.parts.length ?? 0} cash account(s)</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Journals posted</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{overview?.journalCount ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">Immutable, reversing entries only</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Trial balance</p>
          <p className={`mt-1 text-2xl font-bold ${overview?.trialBalanced ? "text-emerald-600" : "text-red-600"}`}>
            {overview?.trialBalanced ? "Balanced" : "Out of balance"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Dr {fmtKsh(overview?.debitTotal ?? 0)} · Cr {fmtKsh(overview?.creditTotal ?? 0)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="card p-6 text-sm text-slate-400">Loading…</p>
        ) : tab === "ledger" ? (
          <LedgerTab onPosted={loadOverview} />
        ) : tab === "statements" ? (
          <StatementsTab />
        ) : tab === "bank" ? (
          <BankTab cashAccounts={cashAccounts} onPosted={loadOverview} />
        ) : tab === "vat" ? (
          <VatTab />
        ) : tab === "periods" ? (
          <PeriodsTab periods={overview?.periods ?? []} onDone={loadOverview} />
        ) : (
          <ManualTab accounts={overview?.accounts ?? []} onPosted={loadOverview} />
        )}
      </div>
    </>
  );
}

/* ------------------------------- Ledger ------------------------------- */

function LedgerTab({ onPosted }: { onPosted: () => void }) {
  const toast = useToast();
  const [journals, setJournals] = useState<LedgerJournal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [reverseId, setReverseId] = useState<string | null>(null);
  const [reverseBusy, setReverseBusy] = useState(false);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (through) params.set("through", through);
      const data = await api<{ journals: LedgerJournal[] }>(`/api/accounting/ledger?${params.toString()}`);
      setJournals(data.journals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ledger");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function backfill() {
    setBackfilling(true);
    try {
      const r = await api<{ created: number }>("/api/accounting/backfill", { method: "POST" });
      toast.success(r.created > 0 ? `Posted ${r.created} existing document(s) to the ledger.` : "Everything is already posted.");
      await load();
      onPosted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  function exportLedger() {
    const rows: (string | number)[][] = [["Ref", "Date", "Source", "Description", "Account code", "Account", "Debit", "Credit"]];
    for (const j of journals ?? []) {
      for (const l of j.lines) {
        rows.push([j.ref, j.date, j.source, j.description, l.accountCode, l.accountName, l.debit || "", l.credit || ""]);
      }
    }
    downloadCsv("general-ledger.csv", rows);
  }

  async function reverseJournal() {
    if (!reverseId) return;
    setReverseBusy(true);
    try {
      await api("/api/accounting/reverse", { method: "POST", json: { journalId: reverseId } });
      toast.success("Journal reversed with a reversing entry.");
      setReverseId(null);
      await load();
      onPosted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reverse journal");
    } finally {
      setReverseBusy(false);
    }
  }

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={through} onChange={(e) => setThrough(e.target.value)} />
        </div>
        <button onClick={load} className="btn-primary">Apply</button>
        <button onClick={backfill} disabled={backfilling} className="btn-secondary ml-auto">
          {backfilling ? "Posting…" : "Post existing documents"}
        </button>
        <button onClick={exportLedger} className="btn-secondary">Export CSV</button>
      </div>

      <p className="mb-3 text-xs text-slate-400">
        Documents post automatically: invoices when marked <span className="font-medium text-slate-600">Sent</span>,
        bills when recorded, petty cash &amp; car logs when <span className="font-medium text-slate-600">approved</span>,
        and payroll when a run is processed. Draft invoices and pending requests are not in the books yet.
      </p>

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {!journals ? (
        <p className="card p-6 text-sm text-slate-400">Loading ledger…</p>
      ) : journals.length === 0 ? (
        <p className="card p-6 text-sm text-slate-400">
          No journals yet. Approve an invoice, bill, petty cash request, car log or payroll run and it will appear here.
        </p>
      ) : (
        <div className="space-y-3">
          {journals.map((j) => (
            <div key={j.id} className={`card overflow-hidden ${j.reversed ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-indigo-600">{j.ref}</span>
                  <span className="text-sm font-medium text-slate-800">{j.description}</span>
                  {j.reversed && <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Reversed</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>
                    {j.date} · {j.source.replace("_", " ")}
                    {j.postedByName ? ` · ${j.postedByName}` : ""}
                  </span>
                  {!j.reversed && j.source === "manual" && (
                    <button onClick={() => setReverseId(j.id)} className="btn-secondary btn-xs text-red-600">
                      Reverse
                    </button>
                  )}
                </div>
              </div>
              <table className="table-base">
                <tbody>
                  {j.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="text-slate-500">{l.accountCode}</td>
                      <td className="font-medium text-slate-800">{l.accountName}</td>
                      <td className="text-right tabular-nums">{l.debit ? fmtKsh(l.debit) : ""}</td>
                      <td className="text-right tabular-nums">{l.credit ? fmtKsh(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!reverseId}
        title="Reverse journal"
        message="Post a reversing entry for this journal? The original entry is kept and a mirror entry cancels it out. This cannot be undone."
        confirmLabel="Reverse"
        busy={reverseBusy}
        onConfirm={reverseJournal}
        onCancel={() => setReverseId(null)}
      />
    </div>
  );
}

/* ----------------------------- Statements ----------------------------- */

function StatementsTab() {
  const [kind, setKind] = useState<"trial" | "pnl" | "bs">("trial");
  const [report, setReport] = useState<{ kind: "trial" | "pnl" | "bs"; value: Trial | Pnl | Bs } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [through, setThrough] = useState(today());

  async function load() {
    setReport(null);
    try {
      const res = await api<{ type: "trial" | "pnl" | "bs"; data: Trial | Pnl | Bs }>(
        `/api/accounting/reports?type=${kind}&through=${through}`
      );
      setReport({ kind: res.type, value: res.data });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, through]);

  function exportStatement() {
    if (!report) return;
    const rows: (string | number)[][] = [];
    if (report.kind === "trial") {
      const d = report.value as Trial;
      rows.push(["Code", "Account", "Debit", "Credit"]);
      for (const r of d.rows) rows.push([r.code, r.name, r.debit || "", r.credit || ""]);
      rows.push(["", "Totals", d.debitTotal, d.creditTotal]);
    } else if (report.kind === "pnl") {
      const d = report.value as Pnl;
      rows.push(["Section", "Account", "Amount"]);
      for (const r of d.income) rows.push(["Income", r.name, r.amount]);
      rows.push(["", "Total income", d.incomeTotal]);
      for (const r of d.expense) rows.push(["Expense", r.name, r.amount]);
      rows.push(["", "Total expenses", d.expenseTotal]);
      rows.push(["", d.profit >= 0 ? "Profit" : "Loss", Math.abs(d.profit)]);
    } else {
      const d = report.value as Bs;
      rows.push(["Section", "Account", "Amount"]);
      for (const r of d.assets) rows.push(["Asset", r.name, r.amount]);
      rows.push(["", "Total assets", d.assetTotal]);
      for (const r of d.liabilities) rows.push(["Liability", r.name, r.amount]);
      rows.push(["", "Total liabilities", d.liabTotal]);
      for (const r of d.equity) rows.push(["Equity", r.name, r.amount]);
      rows.push(["", "Current year result", d.currentYear]);
      rows.push(["", "Liabilities + equity", d.liabTotal + d.equityTotal]);
    }
    downloadCsv(`${report.kind}-statement.csv`, rows);
  }

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex gap-2">
          {([["trial", "Trial balance"], ["pnl", "Profit & loss"], ["bs", "Balance sheet"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setKind(id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                kind === id ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="label">As at</label>
            <input type="date" className="input" value={through} onChange={(e) => setThrough(e.target.value)} />
          </div>
          <button onClick={exportStatement} disabled={!report} className="btn-secondary">Export CSV</button>
        </div>
      </div>

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {!report ? (
        <p className="card p-6 text-sm text-slate-400">Loading statement…</p>
      ) : report.kind === "trial" ? (
        <TrialView d={report.value as Trial} />
      ) : report.kind === "pnl" ? (
        <PnlView d={report.value as Pnl} />
      ) : (
        <BsView d={report.value as Bs} />
      )}
    </div>
  );
}

function TrialView({ d }: { d: Trial }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr><th>Code</th><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr>
        </thead>
        <tbody>
          {d.rows.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-400">No ledger activity yet.</td></tr>}
          {d.rows.map((r) => (
            <tr key={r.code}>
              <td className="text-slate-500">{r.code}</td>
              <td className="font-medium text-slate-800">{r.name}</td>
              <td className="text-right tabular-nums">{r.debit ? fmtKsh(r.debit) : ""}</td>
              <td className="text-right tabular-nums">{r.credit ? fmtKsh(r.credit) : ""}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td colSpan={2} className="text-slate-700">Totals</td>
            <td className="text-right tabular-nums">{fmtKsh(d.debitTotal)}</td>
            <td className="text-right tabular-nums">{fmtKsh(d.creditTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function StatementSection({ title, rows }: { title: string; rows: StatementRow[] }) {
  const list = rows ?? [];
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {list.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">—</p>
      ) : (
        list.map((r) => (
          <div key={r.code} className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
            <span className="text-slate-600">{r.name}</span>
            <span className="tabular-nums text-slate-800">{fmtKsh(r.amount)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function PnlView({ d }: { d: Pnl }) {
  return (
    <div className="card p-5">
      <p className="mb-4 text-sm text-slate-500">{d.from} → {d.through}</p>
      <StatementSection title="Income" rows={d.income} />
      <div className="mb-4 flex justify-between text-sm font-semibold"><span>Total income</span><span className="tabular-nums">{fmtKsh(d.incomeTotal)}</span></div>
      <StatementSection title="Expenses" rows={d.expense} />
      <div className="mb-4 flex justify-between text-sm font-semibold"><span>Total expenses</span><span className="tabular-nums">{fmtKsh(d.expenseTotal)}</span></div>
      <div className="flex justify-between border-t-2 border-slate-900 pt-3 text-base font-bold">
        <span>{d.profit >= 0 ? "Profit" : "Loss"}</span>
        <span className={`tabular-nums ${d.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtKsh(Math.abs(d.profit))}</span>
      </div>
    </div>
  );
}

function BsView({ d }: { d: Bs }) {
  const statTotal = d.liabilities.filter((r) => r.group === "Statutory").reduce((s, r) => s + r.amount, 0);
  const liabRows: StatementRow[] =
    statTotal !== 0
      ? [
          ...d.liabilities.filter((r) => r.group !== "Statutory"),
          { code: "", name: "Statutory deductions (PAYE, NSSF, SHIF, Housing, HELB…)", amount: statTotal, group: "Statutory" },
        ]
      : d.liabilities;
  return (
    <div className="card p-5">
      <p className="mb-4 text-sm text-slate-500">As at {d.through}</p>
      <StatementSection title="Assets" rows={d.assets} />
      <div className="mb-4 flex justify-between text-sm font-semibold"><span>Total assets</span><span className="tabular-nums">{fmtKsh(d.assetTotal)}</span></div>
      <StatementSection title="Liabilities" rows={liabRows} />
      <div className="mb-1 flex justify-between text-sm font-semibold"><span>Total liabilities</span><span className="tabular-nums">{fmtKsh(d.liabTotal)}</span></div>
      <StatementSection title="Equity" rows={d.equity} />
      <div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">Accumulated result</span><span className="tabular-nums">{fmtKsh(d.currentYear)}</span></div>
      <div className="flex justify-between border-t-2 border-slate-900 pt-3 text-base font-bold">
        <span>Liabilities + equity</span>
        <span className="tabular-nums">{fmtKsh(d.equityTotal + d.liabTotal)}</span>
      </div>
      <p className={`mt-3 text-xs font-semibold ${d.balanced ? "text-emerald-600" : "text-red-600"}`}>
        {d.balanced ? "Balance sheet balances." : "Balance sheet does not balance — check the ledger."}
      </p>
    </div>
  );
}

/* ------------------------------- Bank -------------------------------- */

function BankTab({ cashAccounts, onPosted }: { cashAccounts: AccountRow[]; onPosted: () => void }) {
  const toast = useToast();
  const [accountCode, setAccountCode] = useState(cashAccounts[0]?.code ?? "");
  const [lines, setLines] = useState<BankLine[] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceLite[]>([]);
  const [importText, setImportText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountCode && cashAccounts[0]) setAccountCode(cashAccounts[0].code);
  }, [cashAccounts, accountCode]);

  async function load() {
    try {
      const q = accountCode ? `?accountCode=${encodeURIComponent(accountCode)}` : "";
      const data = await api<{ lines: BankLine[] }>(`/api/accounting/bank${q}`);
      setLines(data.lines);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bank lines");
    }
  }
  useEffect(() => {
    load();
    api<{ invoices: InvoiceLite[] }>("/api/invoices").then((d) => setInvoices(d.invoices)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountCode]);

  async function importLines() {
    const parsed = importText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [date, description, amount, reference] = l.split(",").map((x) => x.trim());
        return { date, description, amount: Number(amount), reference };
      })
      .filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.date) && l.description && isFinite(l.amount) && l.amount !== 0);
    if (parsed.length === 0) {
      setError("No valid lines. Use: date,description,amount,reference (one per line).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ imported: number }>("/api/accounting/bank", {
        method: "POST",
        json: { accountCode, lines: parsed },
      });
      toast.success(`Imported ${r.imported} line(s).`);
      setImportText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/accounting/bank/pdf", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { lines?: string[]; error?: string };
        if (!res.ok) {
          setError(data.error || "Could not read that PDF.");
          return;
        }
        const normalized = extractFromPdfText(data.lines ?? []);
        if (normalized.length === 0) {
          setError("Couldn't find transaction rows in that PDF. Try a CSV export, or paste lines manually.");
          return;
        }
        setImportText(normalized.join("\n"));
        setError(null);
        toast.success(`${normalized.length} line(s) detected from the PDF — review, then import.`);
        return;
      }
      const text = await file.text();
      const normalized = normalizeBankCsv(parseCsv(text));
      if (normalized.length === 0) {
        setError("Couldn't find transaction rows in that file. Check the columns or use the manual format.");
        return;
      }
      setImportText(normalized.join("\n"));
      setError(null);
      toast.success(`${normalized.length} line(s) detected — review, then import.`);
    } catch {
      setError("Could not read that file.");
    }
  }

  async function act(lineId: string, action: "charge" | "ignore" | "receive" | "match", extra?: { invoiceId?: string }) {
    setBusy(true);
    try {
      await api("/api/accounting/bank/action", { method: "POST", json: { lineId, action, ...extra } });
      toast.success("Bank line updated.");
      await load();
      onPosted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const unmatched = (lines ?? []).filter((l) => l.status === "unmatched").length;

  return (
    <div>
      <div className="card mb-4 grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <label className="label">Cash / bank account</label>
          <select className="input" value={accountCode} onChange={(e) => setAccountCode(e.target.value)}>
            {cashAccounts.length === 0 && <option value="">No cash accounts</option>}
            {cashAccounts.map((a) => (
              <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-400">
            {unmatched} unmatched line(s). Positive amounts are money in, negative are money out.
          </p>
        </div>
        <div>
          <label className="label">Import a bank / M-Pesa statement</label>
          <input
            type="file"
            accept=".csv,.pdf,text/csv,application/pdf,text/plain"
            onChange={handleFile}
            className="block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
          />
          <p className="mt-2 text-xs text-slate-400">
            Upload a <span className="font-medium text-slate-600">CSV or PDF</span> statement from your bank or
            M-Pesa portal. We detect the date, description and amount columns automatically.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-indigo-600">Or paste / edit lines manually</summary>
            <textarea
              className="input mt-2 font-mono text-xs"
              rows={3}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"2026-09-05,M-Pesa deposit 522522,45000,REF123\n2026-09-06,Bank charges,-250,"}
            />
          </details>
          <button onClick={importLines} disabled={busy || !accountCode || !importText.trim()} className="btn-primary mt-3 w-full">
            {busy ? "Importing…" : "Import lines"}
          </button>
        </div>
      </div>

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {!lines ? (
        <p className="card p-6 text-sm text-slate-400">Loading bank lines…</p>
      ) : lines.length === 0 ? (
        <p className="card p-6 text-sm text-slate-400">No bank lines imported yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th><th>Description</th><th className="text-right">Amount</th>
                <th>Status</th><th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{l.date}</td>
                  <td className="font-medium text-slate-800">{l.description}{l.reference ? <span className="ml-1 text-xs text-slate-400">({l.reference})</span> : null}</td>
                  <td className={`text-right tabular-nums ${l.amount >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {l.amount >= 0 ? "+" : ""}{fmtKsh(Math.abs(l.amount))}
                  </td>
                  <td>
                    <span className={`badge ${
                      l.status === "matched" ? "bg-emerald-100 text-emerald-700"
                        : l.status === "ignored" ? "bg-slate-200 text-slate-600"
                        : "bg-amber-100 text-amber-700"
                    }`}>{l.status}</span>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {l.status === "unmatched" && (
                      <div className="flex items-center justify-end gap-2">
                        {l.amount < 0 ? (
                          <button onClick={() => act(l.id, "charge")} disabled={busy} className="btn-secondary btn-xs">Book as charge</button>
                        ) : (
                          <select
                            className="input w-44 py-1 text-xs"
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) act(l.id, "receive", { invoiceId: e.target.value }); }}
                          >
                            <option value="">Receive against…</option>
                            {invoices.map((inv) => (
                              <option key={inv.id} value={inv.id}>{inv.number} · {inv.contact_name} · {fmtKsh(inv.total)}</option>
                            ))}
                          </select>
                        )}
                        <button onClick={() => act(l.id, "ignore")} disabled={busy} className="btn-secondary btn-xs">Ignore</button>
                      </div>
                    )}
                    {l.status === "matched" && <span className="text-xs text-slate-400">Reconciled</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- VAT -------------------------------- */

function VatTab() {
  const [period, setPeriod] = useState(thisMonth());
  const [data, setData] = useState<VatReturn | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setData(null);
    try {
      setData(await api<VatReturn>(`/api/accounting/vat?period=${period}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load VAT return");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  function exportVat() {
    if (!data) return;
    const rows: (string | number)[][] = [["VAT3 working paper", data.period], []];
    rows.push(["Output VAT (sales)"]);
    rows.push(["Ref", "Date", "Description", "VAT"]);
    for (const l of data.outputLines) rows.push([l.ref, l.date, l.description, l.amount]);
    rows.push(["", "", "Total output", data.output]);
    rows.push([]);
    rows.push(["Input VAT (purchases)"]);
    rows.push(["Ref", "Date", "Description", "VAT"]);
    for (const l of data.inputLines) rows.push([l.ref, l.date, l.description, l.amount]);
    rows.push(["", "", "Total input", data.input]);
    rows.push([]);
    rows.push(["", "", "VAT payable", data.payable]);
    downloadCsv(`vat3-${data.period}.csv`, rows);
  }

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Period</label>
          <input type="month" className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <button onClick={exportVat} disabled={!data} className="btn-secondary ml-auto">Export VAT3 CSV</button>
      </div>

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {!data ? (
        <p className="card p-6 text-sm text-slate-400">Loading VAT return…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <p className="text-sm text-slate-500">Output VAT (on sales)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{fmtKsh(data.output)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">Input VAT (on purchases)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{fmtKsh(data.input)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">{data.payable >= 0 ? "VAT payable" : "VAT credit"}</p>
              <p className={`mt-1 text-2xl font-bold ${data.payable >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                {fmtKsh(Math.abs(data.payable))}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Output VAT lines</p>
              <table className="table-base">
                <tbody>
                  {data.outputLines.length === 0 && <tr><td className="py-6 text-center text-slate-400">None</td></tr>}
                  {data.outputLines.map((l, i) => (
                    <tr key={i}>
                      <td className="text-slate-500">{l.ref}</td>
                      <td className="text-slate-800">{l.description}</td>
                      <td className="text-right tabular-nums">{fmtKsh(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card overflow-hidden">
              <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Input VAT lines</p>
              <table className="table-base">
                <tbody>
                  {data.inputLines.length === 0 && <tr><td className="py-6 text-center text-slate-400">None</td></tr>}
                  {data.inputLines.map((l, i) => (
                    <tr key={i}>
                      <td className="text-slate-500">{l.ref}</td>
                      <td className="text-slate-800">{l.description}</td>
                      <td className="text-right tabular-nums">{fmtKsh(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Accounting prepares the working paper only — file the return on iTax. VAT is due by the 20th of the following month.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Periods ------------------------------- */

function PeriodsTab({ periods, onDone }: { periods: Overview["periods"]; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingLock, setPendingLock] = useState<string | null>(null);

  async function act(period: string, action: "lock" | "unlock") {
    setBusy(period);
    try {
      await api("/api/accounting/periods", { method: "POST", json: { period, action } });
      toast.success(action === "lock" ? "Period locked." : "Period unlocked.");
      setPendingLock(null);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr><th>Period</th><th>Status</th><th>Locked</th><th className="text-right">Action</th></tr>
        </thead>
        <tbody>
          {periods.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-400">No periods yet.</td></tr>}
          {periods.map((p) => (
            <tr key={p.period}>
              <td className="font-medium text-slate-800">{p.label}</td>
              <td>
                <span className={`badge ${p.status === "locked" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {p.status}
                </span>
              </td>
              <td className="text-slate-500">{p.lockedAt ?? "—"}</td>
              <td className="text-right">
                {p.status === "locked" ? (
                  <button onClick={() => act(p.period, "unlock")} disabled={busy === p.period} className="btn-secondary px-3 py-1.5 text-xs">
                    Unlock
                  </button>
                ) : (
                  <button onClick={() => setPendingLock(p.period)} disabled={busy === p.period} className="btn-secondary px-3 py-1.5 text-xs">
                    Lock
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={!!pendingLock}
        title="Lock accounting period"
        message="Lock this period? No further entries can be posted to it until you unlock it. Use this once a month is finalised and reconciled."
        confirmLabel="Lock period"
        tone="default"
        busy={busy === pendingLock}
        onConfirm={() => pendingLock && act(pendingLock, "lock")}
        onCancel={() => setPendingLock(null)}
      />
    </div>
  );
}

/* --------------------------- Manual journal --------------------------- */

function ManualTab({ accounts, onPosted }: { accounts: AccountRow[]; onPosted: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState([
    { accountCode: "", debit: "", credit: "" },
    { accountCode: "", debit: "", credit: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState(false);
  const [costCentres, setCostCentres] = useState<{ code: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [costCentre, setCostCentre] = useState("");
  const [project, setProject] = useState("");

  useEffect(() => {
    api<{ costCentres: { code: string; name: string }[] }>("/api/management/cost-centres")
      .then((d) => setCostCentres(d.costCentres ?? []))
      .catch(() => setCostCentres([]));
    api<{ projects: { _id: string; name: string }[] }>("/api/management/projects")
      .then((d) => setProjects((d.projects ?? []).map((p) => ({ id: p._id, name: p.name }))))
      .catch(() => setProjects([]));
  }, []);

  const dr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const cr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.round(dr) === Math.round(cr) && dr > 0;

  function setLine(i: number, patch: Partial<(typeof lines)[number]>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/accounting/journal", {
        method: "POST",
        json: {
          date,
          description,
          adjustment,
          lines: lines
            .filter((l) => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0))
            .map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, costCenterCode: costCentre || undefined, projectId: project || undefined })),
        },
      });
      toast.success("Journal posted.");
      setDescription("");
      setLines([{ accountCode: "", debit: "", credit: "" }, { accountCode: "", debit: "", credit: "" }]);
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post journal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Opening balance" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Cost centre (optional)</label>
          <select className="input" value={costCentre} onChange={(e) => setCostCentre(e.target.value)}>
            <option value="">— none —</option>
            {costCentres.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Project (optional)</label>
          <select className="input" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">— none —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <select className={`${inputCls()} col-span-6`} value={l.accountCode} onChange={(e) => setLine(i, { accountCode: e.target.value })}>
              <option value="">Select account…</option>
              {accounts.map((a) => (
                <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
              ))}
            </select>
            <input className={`${inputCls()} col-span-3`} type="number" min="0" step="0.01" placeholder="Debit" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: "" })} />
            <input className={`${inputCls()} col-span-3`} type="number" min="0" step="0.01" placeholder="Credit" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: "" })} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => setLines((p) => [...p, { accountCode: "", debit: "", credit: "" }])} className="text-xs font-medium text-indigo-600 hover:underline">
          + Add line
        </button>
        <p className={`text-sm font-semibold ${balanced ? "text-emerald-600" : "text-amber-600"}`}>
          Dr {fmtKsh(dr)} · Cr {fmtKsh(cr)} {balanced ? "· balanced" : "· not balanced"}
        </p>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={adjustment} onChange={(e) => setAdjustment(e.target.checked)} />
        Adjustment journal (may post into a closed period; never into a locked one)
      </label>
      <button onClick={submit} disabled={busy || !balanced || !description.trim()} className="btn-primary mt-4 w-full">
        {busy ? "Posting…" : "Post journal"}
      </button>
      <p className="mt-2 text-xs text-slate-400">
        Use a manual journal only when there is no source document. Posted journals can be reversed, never edited.
      </p>
    </div>
  );
}
