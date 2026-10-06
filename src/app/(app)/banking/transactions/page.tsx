"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, Modal, StatusBadge, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { parseDelimited, normalizeStatementDetailed, type NormalizedTxn } from "@/lib/bankImport";

interface BankAccount { id: string; name: string; kind: string; accountCode: string; active: boolean; }
interface Txn {
  id: string; accountCode: string; date: string; description: string; amount: number;
  reference: string | null; status: string; source: string; matched: number; remaining: number;
}
interface Candidate { journalId: string; ref: string; date: string; description: string; amount: number; confidence: string; }
interface Suggestions { rule: { id: string; name: string; accountCode: string; autoPost: boolean; suggestType: string | null } | null; candidates: Candidate[]; }
interface Account { code: string; name: string; type: string; isCash: boolean; active: boolean; }
interface RecItem { date: string; description: string; remaining: number; ref?: string; reference?: string | null; }
interface RecLedger {
  bookBalance: number;
  statementClosingBalance: number;
  statementMovement: number;
  matchedCount: number;
  unpresentedCheques: RecItem[];
  uncreditedDeposits: RecItem[];
  directDebits: RecItem[];
  directCredits: RecItem[];
  totals: { unpresentedCheques: number; uncreditedDeposits: number; directDebits: number; directCredits: number };
  adjustedBank: number;
  adjustedBook: number;
  difference: number;
  unreconciledCount: number;
}

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

export default function BankingTransactionsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountCode, setAccountCode] = useState("");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [chart, setChart] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Txn | null>(null);
  const [suggest, setSuggest] = useState<Suggestions | null>(null);
  const [amount, setAmount] = useState("");
  const [counter, setCounter] = useState("");
  const [busy, setBusy] = useState(false);

  const [importFor, setImportFor] = useState(false);
  const [importText, setImportText] = useState("");
  const [parsed, setParsed] = useState<{ transactions: NormalizedTxn[]; mode: string } | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [manualFor, setManualFor] = useState(false);
  const [transferFor, setTransferFor] = useState(false);
  const [recFor, setRecFor] = useState(false);

  const [mDate, setMDate] = useState(today());
  const [mDesc, setMDesc] = useState("");
  const [mAmount, setMAmount] = useState("");
  const [mCounter, setMCounter] = useState("");

  const [tFrom, setTFrom] = useState(""), [tTo, setTTo] = useState(""), [tAmount, setTAmount] = useState(""), [tRef, setTRef] = useState("");
  const [recClosing, setRecClosing] = useState("");
  const [recLedger, setRecLedger] = useState<RecLedger | null>(null);
  const toast = useToast();

  useEffect(() => {
    api<{ accounts: BankAccount[] }>("/api/banking/accounts")
      .then((d) => {
        const list = d.accounts.filter((a) => a.active);
        setAccounts(list);
        if (list[0]) setAccountCode(list[0].accountCode);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load accounts"));
    api<{ accounts: Account[] }>("/api/accounting/chart")
      .then((d) => setChart(d.accounts.filter((a) => a.active && !a.isCash)))
      .catch(() => setChart([]));
  }, []);

  const load = useCallback(async () => {
    if (!accountCode) return;
    setLoading(true);
    try {
      const d = await api<{ transactions: Txn[] }>(`/api/banking/transactions?accountCode=${accountCode}`);
      setTxns(d.transactions);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load transactions"); }
    finally { setLoading(false); }
  }, [accountCode]);

  useEffect(() => { void load(); }, [load]);

  async function openActions(t: Txn) {
    setActive(t);
    setAmount(String(t.remaining));
    setCounter("");
    setSuggest(null);
    try {
      const d = await api<Suggestions>(`/api/banking/transactions/${t.id}/suggest`);
      setSuggest(d);
    } catch { /* ignore */ }
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!active) return;
    setBusy(true);
    try {
      await api(`/api/banking/transactions/${active.id}/action`, {
        method: "POST",
        json: { action, amount: Number(amount) || undefined, counterAccountCode: counter || undefined, ...extra },
      });
      toast.success("Done.");
      setActive(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  }

  async function parseFile(file: File, password?: string) {
    setFileBusy(true);
    setError(null);
    setParsed(null);
    setFileName(file.name);
    setPendingFile(file);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (password) fd.append("password", password);
      const res = await fetch("/api/banking/import-file", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not parse the file");
      if (d.needsPassword) {
        setNeedsPassword(true);
        if (d.wrongPassword) toast.error("Incorrect PDF password. Please try again.");
        return;
      }
      setNeedsPassword(false);
      setParsed({ transactions: d.transactions, mode: d.detected?.mode ?? "auto" });
      toast.success(`${d.count} transaction(s) detected. Review then import.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setFileBusy(false);
    }
  }

  function parseText() {
    setError(null);
    try {
      const { transactions, detected } = normalizeStatementDetailed(parseDelimited(importText));
      if (transactions.length === 0) throw new Error("No transactions detected in the pasted text.");
      setParsed({ transactions, mode: detected.mode });
      setFileName("pasted text");
      toast.success(`${transactions.length} transaction(s) detected.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse");
    }
  }

  async function importParsed() {
    if (!parsed) return;
    setBusy(true);
    try {
      const res = await api<{ imported: number; skipped: number }>("/api/banking/transactions/import", {
        method: "POST",
        json: { accountCode, lines: parsed.transactions },
      });
      toast.success(`Imported ${res.imported}, skipped ${res.skipped} duplicate(s).`);
      setImportFor(false);
      setImportText("");
      setParsed(null);
      setFileName("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(false); }
  }

  async function doManual() {
    setBusy(true);
    try {
      await api("/api/banking/transactions", {
        method: "POST",
        json: { accountCode, date: mDate, description: mDesc, amount: Number(mAmount), counterAccountCode: mCounter || undefined },
      });
      toast.success("Recorded.");
      setManualFor(false);
      setMDesc(""); setMAmount(""); setMCounter("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function doTransfer() {
    setBusy(true);
    try {
      await api("/api/banking/transfers", {
        method: "POST",
        json: { date: today(), fromAccountCode: tFrom, toAccountCode: tTo, amount: Number(tAmount), reference: tRef },
      });
      toast.success("Transfer posted.");
      setTransferFor(false);
      setTFrom(""); setTTo(""); setTAmount(""); setTRef("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Transfer failed"); }
    finally { setBusy(false); }
  }

  async function loadSummary() {
    try {
      const d = await api<{ ledger: RecLedger }>(
        `/api/banking/reconcile?accountCode=${accountCode}&statementClosingBalance=${Number(recClosing) || 0}`
      );
      setRecLedger(d.ledger);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function runAutoMatch() {
    setBusy(true);
    try {
      const res = await api<{ matched: number }>("/api/banking/auto-match", { method: "POST", json: { accountCode } });
      toast.success(`Auto-matched ${res.matched} item(s).`);
      await load();
      if (recLedger) await loadSummary();
    } catch (e) { setError(e instanceof Error ? e.message : "Auto-match failed"); }
    finally { setBusy(false); }
  }

  async function completeRec(force: boolean) {
    setBusy(true);
    try {
      await api("/api/banking/reconcile", {
        method: "POST",
        json: { accountCode, periodEnd: today(), statementClosingBalance: Number(recClosing) || 0, force },
      });
      toast.success("Reconciliation completed.");
      setRecFor(false);
      setRecLedger(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to complete"); }
    finally { setBusy(false); }
  }

  const cashAccounts = useMemo(() => accounts.map((a) => ({ code: a.accountCode, name: a.name })), [accounts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank transactions & reconciliation"
        subtitle="Import a statement, then match each line to the books. Nothing is deleted — lines move through unmatched → matched → reconciled."
      />
      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <select className="input max-w-xs" value={accountCode} onChange={(e) => setAccountCode(e.target.value)}>
          {accounts.length === 0 && <option value="">No accounts</option>}
          {accounts.map((a) => <option key={a.id} value={a.accountCode}>{a.name}</option>)}
        </select>
        <button className="btn-secondary" onClick={() => setImportFor(true)} disabled={!accountCode}>Import statement</button>
        <button className="btn-secondary" onClick={() => setManualFor(true)} disabled={!accountCode}>Manual transaction</button>
        <button className="btn-secondary" onClick={() => { setTFrom(accountCode); setTransferFor(true); }} disabled={accounts.length < 2}>Transfer</button>
        <button className="btn-secondary ml-auto" onClick={runAutoMatch} disabled={busy || !accountCode}>Auto-match</button>
        <button className="btn-primary" onClick={() => { setRecFor(true); setRecLedger(null); }} disabled={!accountCode}>Reconcile</button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : txns.length === 0 ? (
        <p className="card p-6 text-sm text-slate-400">No transactions for this account.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txns.map((t) => (
                <tr key={t.id} className={t.status === "reconciled" ? "opacity-60" : ""}>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{t.date}</td>
                  <td className="px-4 py-3 text-slate-700">{t.description}</td>
                  <td className="px-4 py-3 text-slate-500">{t.reference ?? "—"}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${t.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>{fmtKsh(t.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{fmtKsh(t.remaining)}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-secondary btn-xs" onClick={() => openActions(t)} disabled={t.status === "reconciled"}>Reconcile</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action modal */}
      {active && (
        <Modal title={`Reconcile — ${active.description}`} onClose={() => setActive(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              Statement amount <strong>{fmtKsh(active.amount)}</strong> · remaining <strong>{fmtKsh(active.remaining)}</strong>
            </p>
            {suggest?.rule && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                Rule “{suggest.rule.name}” suggests account <strong>{suggest.rule.accountCode}</strong>
                {suggest.rule.autoPost ? " (auto-post enabled)" : ""}.
              </div>
            )}
            <div>
              <label className="label">Amount to match</label>
              <input type="number" className={inputCls()} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary" onClick={() => act("receipt")} disabled={busy || active.amount <= 0}>Create receipt</button>
              <button className="btn-secondary" onClick={() => act("payment")} disabled={busy || active.amount >= 0}>Create payment</button>
            </div>

            <div>
              <label className="label">Classify to account (expense / income)</label>
              <div className="flex gap-2">
                <select className={inputCls()} value={counter} onChange={(e) => setCounter(e.target.value)}>
                  <option value="">Select account…</option>
                  {suggest?.rule && <option value={suggest.rule.accountCode}>{suggest.rule.accountCode} (rule)</option>}
                  {chart.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </select>
                <button className="btn-primary whitespace-nowrap" onClick={() => act("expense")} disabled={busy || !counter}>Post</button>
              </div>
            </div>

            {suggest && suggest.candidates.length > 0 && (
              <div className="rounded-lg border border-slate-200">
                <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Suggested book entries
                </p>
                <div className="max-h-48 divide-y divide-slate-100 overflow-auto">
                  {suggest.candidates.map((c) => (
                    <div key={c.journalId} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">{c.description}</p>
                        <p className="text-xs text-slate-400">{c.ref} · {c.date} · {c.confidence} confidence</p>
                      </div>
                      <button className="btn-secondary btn-xs" onClick={() => act("match", { journalId: c.journalId })} disabled={busy}>Match</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2 border-t border-slate-100 pt-3">
              <button className="btn-secondary text-red-600" onClick={() => act("ignore")} disabled={busy}>Ignore</button>
              <button className="btn-secondary" onClick={() => act("unmatch")} disabled={busy || active.matched === 0}>Unmatch</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import modal */}
      {importFor && (
        <Modal title="Import bank / M-Pesa statement" onClose={() => { setImportFor(false); setParsed(null); }}>
          <div className="space-y-3">
            <div>
              <label className="label">Upload a statement file</label>
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf"
                className="input"
                disabled={fileBusy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void parseFile(f); }}
              />
              <p className="mt-1 text-xs text-slate-500">
                CSV, Excel (.xlsx/.xls) or PDF. Debit/Credit (or a single Amount) columns are detected
                automatically; the running Balance column is ignored. Password-protected PDFs can be
                unlocked below.
              </p>
            </div>

            {needsPassword && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">
                  {fileName} is password-protected. Enter the PDF password to unlock it.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="password"
                    className={inputCls()}
                    value={pdfPassword}
                    placeholder="PDF password"
                    onChange={(e) => setPdfPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && pendingFile) void parseFile(pendingFile, pdfPassword); }}
                  />
                  <button
                    className="btn-primary whitespace-nowrap"
                    onClick={() => pendingFile && parseFile(pendingFile, pdfPassword)}
                    disabled={fileBusy || !pdfPassword}
                  >
                    {fileBusy ? "Unlocking…" : "Unlock"}
                  </button>
                </div>
              </div>
            )}

            <details className="rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer text-xs font-medium text-indigo-600">Or paste text instead</summary>
              <div className="mt-2 space-y-2">
                <textarea
                  className={inputCls()}
                  rows={6}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={"Date,Description,Debit,Credit\n2026-09-05,M-Pesa deposit 522522,,45000\n2026-09-06,Bank charges,250,"}
                />
                <button className="btn-secondary text-xs" onClick={parseText} disabled={!importText.trim()}>Parse pasted text</button>
              </div>
            </details>

            {fileBusy && <p className="text-sm text-slate-500">Reading file…</p>}

            {parsed && (
              <div className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-600">{parsed.transactions.length} transaction(s) · {fileName}</span>
                  <span className="text-slate-400">detected: {parsed.mode.replace("_", " ")}</span>
                </div>
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="px-3 py-1.5">Date</th>
                        <th className="px-3 py-1.5">Description</th>
                        <th className="px-3 py-1.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsed.transactions.slice(0, 30).map((t, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">{t.date}</td>
                          <td className="px-3 py-1.5 text-slate-600">{t.description}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums ${t.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtKsh(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.transactions.length > 30 && (
                    <p className="px-3 py-2 text-xs text-slate-400">Showing first 30 of {parsed.transactions.length}.</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => { setImportFor(false); setParsed(null); }} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={importParsed} disabled={busy || !parsed || parsed.transactions.length === 0}>
                {busy ? "Importing…" : parsed ? `Import ${parsed.transactions.length} transaction(s)` : "Import"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manual modal */}
      {manualFor && (
        <Modal title="Manual bank transaction" onClose={() => setManualFor(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Date</label><input type="date" className={inputCls()} value={mDate} onChange={(e) => setMDate(e.target.value)} /></div>
              <div><label className="label">Amount (signed)</label><input type="number" className={inputCls()} value={mAmount} onChange={(e) => setMAmount(e.target.value)} /></div>
            </div>
            <div><label className="label">Description</label><input className={inputCls()} value={mDesc} onChange={(e) => setMDesc(e.target.value)} /></div>
            <div>
              <label className="label">Counter account (optional)</label>
              <select className={inputCls()} value={mCounter} onChange={(e) => setMCounter(e.target.value)}>
                <option value="">— leave to match later —</option>
                {chart.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setManualFor(false)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={doManual} disabled={busy || !mDesc.trim() || !mAmount}>{busy ? "Saving…" : "Record"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Transfer modal */}
      {transferFor && (
        <Modal title="Transfer money" onClose={() => setTransferFor(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">From</label>
                <select className={inputCls()} value={tFrom} onChange={(e) => setTFrom(e.target.value)}>
                  {cashAccounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">To</label>
                <select className={inputCls()} value={tTo} onChange={(e) => setTTo(e.target.value)}>
                  <option value="">Select…</option>
                  {cashAccounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Amount</label><input type="number" className={inputCls()} value={tAmount} onChange={(e) => setTAmount(e.target.value)} /></div>
              <div><label className="label">Reference</label><input className={inputCls()} value={tRef} onChange={(e) => setTRef(e.target.value)} /></div>
            </div>
            <p className="text-xs text-slate-400">Transfers post Dr destination / Cr source — never income or expense.</p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setTransferFor(false)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={doTransfer} disabled={busy || !tFrom || !tTo || !tAmount}>{busy ? "Posting…" : "Post transfer"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reconcile modal */}
      {recFor && (
        <Modal title="Reconcile account" onClose={() => setRecFor(false)}>
          <div className="space-y-3 text-sm">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label">Statement closing balance</label>
                <input type="number" className={inputCls()} value={recClosing} onChange={(e) => setRecClosing(e.target.value)} />
              </div>
              <button className="btn-secondary" onClick={loadSummary}>Calculate</button>
            </div>
            {recLedger && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bank statement</p>
                    <Row label="Balance per bank statement" value={recLedger.statementClosingBalance} />
                    <Row label="Add: Uncredited deposits" value={recLedger.totals.uncreditedDeposits} />
                    <Row label="Less: Unpresented cheques" value={-recLedger.totals.unpresentedCheques} />
                    <Row label="Adjusted balance per bank" value={recLedger.adjustedBank} bold />
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cash book</p>
                    <Row label="Balance per cash book" value={recLedger.bookBalance} />
                    <Row label="Add: Direct credits" value={recLedger.totals.directCredits} />
                    <Row label="Less: Direct debits" value={-recLedger.totals.directDebits} />
                    <Row label="Adjusted balance per cash book" value={recLedger.adjustedBook} bold />
                  </div>
                </div>
                <Row label="Difference" value={recLedger.difference} bold danger={Math.abs(recLedger.difference) > 0.5} />

                <RecSection title="Unpresented cheques" hint="Issued & recorded, not yet on the statement" items={recLedger.unpresentedCheques} />
                <RecSection title="Uncredited deposits" hint="Recorded receipts not yet credited by the bank" items={recLedger.uncreditedDeposits} />
                <RecSection title="Direct debits" hint="On the statement, not yet in the cash book" items={recLedger.directDebits} />
                <RecSection title="Direct credits" hint="On the statement, not yet in the cash book" items={recLedger.directCredits} />

                <p className="text-xs text-slate-500">
                  {recLedger.matchedCount} matched · {recLedger.unreconciledCount} outstanding item(s)
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setRecFor(false)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={() => completeRec(false)} disabled={busy || !recLedger || Math.abs(recLedger.difference) > 0.5}>
                Complete
              </button>
              <button className="btn-secondary text-amber-700" onClick={() => completeRec(true)} disabled={busy || !recLedger || Math.abs(recLedger.difference) <= 0.5}>
                Force with adjustment
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value, bold, danger }: { label: string; value: number; bold?: boolean; danger?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? "font-semibold" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span className={`tabular-nums ${danger ? "text-red-600" : "text-slate-800"}`}>{fmtKsh(value)}</span>
    </div>
  );
}

function RecSection({ title, hint, items }: { title: string; hint: string; items: RecItem[] }) {
  const total = items.reduce((s, i) => s + i.remaining, 0);
  if (items.length === 0) return null;
  return (
    <details className="rounded-lg border border-slate-200" open>
      <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>{title} <span className="font-normal normal-case text-slate-400">· {hint}</span></span>
        <span className="tabular-nums text-slate-700">{fmtKsh(total)}</span>
      </summary>
      <div className="max-h-40 divide-y divide-slate-100 overflow-auto border-t border-slate-100">
        {items.map((i, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
            <span className="min-w-0 truncate text-slate-600">{i.description}</span>
            <span className="whitespace-nowrap text-xs text-slate-400">{i.date}</span>
            <span className="w-24 text-right tabular-nums text-slate-700">{fmtKsh(i.remaining)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
