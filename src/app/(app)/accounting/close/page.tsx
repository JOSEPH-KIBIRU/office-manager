"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Task { _id: string; key: string; label: string; status: string; note: string | null; }
interface Summary {
  trialBalanceDifference: number; unreconciledBankTransactions: number; outstandingAR: number; outstandingAP: number;
  payrollRuns: number; unpostedPayroll: boolean; unpostedDepreciation: number; vatPayable: number;
  draftInvoices: number; draftBills: number; critical: boolean;
}

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const STATUSES = ["pending", "in_progress", "complete", "blocked"];
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  return d.toISOString().slice(0, 7);
});

export default function ClosePage() {
  const [period, setPeriod] = useState(MONTHS[0]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ tasks: Task[]; summary: Summary }>(`/api/accounting/close?period=${period}`);
      setTasks(d.tasks);
      setSummary(d.summary);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  async function setTask(key: string, status: string) {
    try { await api("/api/accounting/close", { method: "POST", json: { action: "task", period, key, status } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function changePeriodStatus(status: string) {
    setBusy(true);
    try { await api("/api/accounting/close", { method: "POST", json: { action: "status", period, status } }); toast.success(`Period ${status}.`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function close(force: boolean) {
    setBusy(true);
    try { await api("/api/accounting/close", { method: "POST", json: { action: "close", period, force } }); toast.success("Period closed."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to close"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Month-end close" subtitle="Work the checklist, review the integrity checks, then close the period. Closed periods block normal postings (adjustments and reversals remain possible)." />
      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <select className="input max-w-[12rem]" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button className="btn-secondary" onClick={() => changePeriodStatus("pending_close")} disabled={busy}>Mark pending close</button>
        <button className="btn-primary" onClick={() => close(false)} disabled={busy || !summary || summary.critical}>Close period</button>
        <button className="btn-secondary text-amber-700" onClick={() => close(true)} disabled={busy || !summary || !summary.critical}>Force close</button>
        <button className="btn-secondary" onClick={() => changePeriodStatus("locked")} disabled={busy}>Lock period</button>
        <button className="btn-secondary" onClick={() => changePeriodStatus("open")} disabled={busy}>Reopen</button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Checklist</h3>
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-sm text-slate-700">{t.label}</span>
                  <select className="input max-w-[9rem] py-1 text-xs" value={t.status} onChange={(e) => setTask(t.key, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Integrity checks</h3>
            {summary && (
              <div className="space-y-1 text-sm">
                <Check label="Trial balance difference" value={fmtKsh(summary.trialBalanceDifference)} bad={summary.trialBalanceDifference !== 0} />
                <Check label="Unreconciled bank transactions" value={String(summary.unreconciledBankTransactions)} bad={summary.unreconciledBankTransactions > 0} />
                <Check label="Outstanding AR" value={fmtKsh(summary.outstandingAR)} bad={false} />
                <Check label="Outstanding AP" value={fmtKsh(summary.outstandingAP)} bad={false} />
                <Check label="Payroll runs this month" value={String(summary.payrollRuns)} bad={summary.unpostedPayroll} />
                <Check label="Assets awaiting depreciation" value={String(summary.unpostedDepreciation)} bad={summary.unpostedDepreciation > 0} />
                <Check label="VAT payable (period)" value={fmtKsh(summary.vatPayable)} bad={false} />
                <Check label="Draft invoices / bills" value={`${summary.draftInvoices} / ${summary.draftBills}`} bad={false} />
                <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${summary.critical ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {summary.critical ? "Critical: trial balance is out of balance — close is blocked until corrected." : "No blocking integrity issues."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Check({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5">
      <span className="text-slate-600">{label}</span>
      <span className={`tabular-nums font-medium ${bad ? "text-red-600" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}
