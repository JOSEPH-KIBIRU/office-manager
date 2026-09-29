"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Alert, FieldError, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { PettyCashRow } from "@/lib/types";

const AUTO_APPROVE_LIMIT = 5000;

interface LineItem {
  amount: string;
  purpose: string;
  dateNeeded: string;
}

export default function PettyCashPage() {
  const session = useSession();
  const isAdmin = session.role === "admin";
  const isManager = session.role === "manager" || isAdmin;
  const [rows, setRows] = useState<PettyCashRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<{ id: string; action: "approve" | "reject" | "paid" } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const toast = useToast();

  const today = new Date().toISOString().slice(0, 10);
  const [lines, setLines] = useState<LineItem[]>([
    { amount: "", purpose: "", dateNeeded: today },
  ]);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  function newLine(): LineItem {
    return { amount: "", purpose: "", dateNeeded: new Date().toISOString().slice(0, 10) };
  }

  function updateLine(idx: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    setLineErrors((prev) => {
      const next = { ...prev };
      if ("amount" in patch) delete next[`amount_${idx}`];
      if ("purpose" in patch) delete next[`purpose_${idx}`];
      if ("dateNeeded" in patch) delete next[`date_${idx}`];
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()]);
  }

  function removeLine(idx: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function load(scope?: "mine") {
    setLoading(true);
    try {
      const data = await api<{ requests: PettyCashRow[] }>(scope ? "/api/petty-cash?scope=mine" : "/api/petty-cash");
      setRows(data.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load petty cash requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ---- Monthly allocation ----
  const canSetBudget = session.role === "admin" || session.role === "secretary";
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [budget, setBudget] = useState<{
    amount: number;
    spent: number;
    pending: number;
    remaining: number;
    set_at: string | null;
  } | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetBusy, setBudgetBusy] = useState(false);

  async function loadBudget() {
    try {
      const b = await api<{ amount: number; spent: number; pending: number; remaining: number; set_at: string | null }>(
        `/api/petty-cash/budget?period=${period}`
      );
      setBudget(b);
      setBudgetInput(b.amount ? String(b.amount) : "");
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    loadBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function saveBudget() {
    setBudgetBusy(true);
    try {
      await api("/api/petty-cash/budget", { method: "POST", json: { period, amount: Number(budgetInput) || 0 } });
      toast.success("Monthly allocation saved.");
      await loadBudget();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save allocation");
    } finally {
      setBudgetBusy(false);
    }
  }

  const fmtKsh = (n: number) => "KES " + Math.round(n).toLocaleString("en-KE");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    lines.forEach((l, i) => {
      const amt = Number(l.amount);
      if (!l.amount || isNaN(amt) || amt <= 0) errs[`amount_${i}`] = "Enter a valid amount";
      if (!l.purpose.trim()) errs[`purpose_${i}`] = "Required";
      if (!l.dateNeeded) errs[`date_${i}`] = "Required";
    });
    if (Object.keys(errs).length > 0) {
      setLineErrors(errs);
      return;
    }
    setLineErrors({});
    setBusy(true);
    setError(null);
    try {
      const items = lines.map((l) => ({
        amount: Number(l.amount),
        purpose: l.purpose.trim(),
        date_needed: l.dateNeeded,
      }));
      const res = await api<{ auto_approved: number; awaiting_approval: number; total: string }>(
        "/api/petty-cash",
        { method: "POST", json: { items } }
      );
      setLines([newLine()]);
      if (res.auto_approved > 0 && res.awaiting_approval > 0) {
        toast.success(`${res.auto_approved} line(s) auto-approved (≤ KSh ${AUTO_APPROVE_LIMIT.toLocaleString()}). ${res.awaiting_approval} line(s) awaiting approval.`);
      } else if (res.auto_approved > 0) {
        toast.success(`${res.auto_approved} line(s) auto-approved. The director has been notified of the total.`);
      } else {
        toast.success(`Request submitted (KES ${res.total}). The director has been notified for approval.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "approve" | "reject" | "paid") {
    setActionBusy(true);
    try {
      await api(`/api/petty-cash/${id}`, { method: "PATCH", json: { action } });
      toast.success(
        action === "approve" ? "Request approved." :
        action === "reject" ? "Request rejected." : "Request marked as paid."
      );
      setPendingAction(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Office Petty Cash" subtitle="Request small office funds. Approved requests get a printable requisition form." />

      {/* Monthly allocation */}
      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-800">Monthly allocation</h2>
            <p className="text-xs text-slate-500">
              Set the petty-cash float for the month. Approved expenses deduct from it automatically, and the
              ledger records the funding (Dr Petty cash / Cr Bank) — no double counting.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="pc-period">Month</label>
              <input id="pc-period" type="month" className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            {canSetBudget && (
              <>
                <div>
                  <label className="label" htmlFor="pc-budget">Allocation (KES)</label>
                  <input
                    id="pc-budget"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input w-40"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder="e.g. 20000"
                  />
                </div>
                <button onClick={saveBudget} disabled={budgetBusy} className="btn-primary">
                  {budgetBusy ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Allocated</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900">{fmtKsh(budget?.amount ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Spent (approved)</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900">{fmtKsh(budget?.spent ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Pending</p>
            <p className="mt-0.5 text-lg font-bold text-amber-700">{fmtKsh(budget?.pending ?? 0)}</p>
          </div>
          <div className={`rounded-lg border p-3 ${(budget?.remaining ?? 0) < 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className="text-xs text-slate-500">Remaining</p>
            <p className={`mt-0.5 text-lg font-bold ${(budget?.remaining ?? 0) < 0 ? "text-red-700" : "text-emerald-700"}`}>
              {fmtKsh(budget?.remaining ?? 0)}
            </p>
          </div>
        </div>
        {(budget?.remaining ?? 0) < 0 && (
          <p className="mt-2 text-xs font-medium text-red-600">
            Spend exceeds the allocation for this month. Top up the allocation or review the requests.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card h-fit p-5">
          <h2 className="mb-1 font-semibold">New request</h2>
          <p className="mb-4 text-xs text-slate-500">
            Add one or more lines and submit together. Lines up to and including{" "}
            <strong>KSh {AUTO_APPROVE_LIMIT.toLocaleString()}</strong> are auto-approved; anything above needs the director&apos;s approval.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-3">
              {lines.map((l, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Line {i + 1}
                    </span>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(i)} className="text-xs text-red-500 hover:underline">
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-500">Amount (KES)</label>
                      <input
                        type="number" min="1" step="0.01" className={`input w-full py-1.5 text-sm ${lineErrors[`amount_${i}`] ? "input-invalid" : ""}`}
                        value={l.amount}
                        onChange={(e) => updateLine(i, { amount: e.target.value })}
                        placeholder="0.00" required
                      />
                      <FieldError msg={lineErrors[`amount_${i}`]} />
                      <p className={`mt-0.5 text-[10px] font-medium ${Number(l.amount) && Number(l.amount) > AUTO_APPROVE_LIMIT ? "text-amber-600" : "text-emerald-600"}`}>
                        {Number(l.amount) && Number(l.amount) > AUTO_APPROVE_LIMIT ? "Needs approval" : "Auto-approves"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[11px] font-medium text-slate-500">Purpose</label>
                      <input
                        className={`input w-full py-1.5 text-sm ${lineErrors[`purpose_${i}`] ? "input-invalid" : ""}`} value={l.purpose}
                        onChange={(e) => updateLine(i, { purpose: e.target.value })}
                        placeholder="What will this be used for?" required
                      />
                      <FieldError msg={lineErrors[`purpose_${i}`]} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="text-[11px] font-medium text-slate-500">Date needed</label>
                    <input type="date" className={`input w-full py-1.5 text-sm ${lineErrors[`date_${i}`] ? "input-invalid" : ""}`} value={l.dateNeeded}
                      onChange={(e) => updateLine(i, { dateNeeded: e.target.value })}
                      min={today} required
                    />
                    <FieldError msg={lineErrors[`date_${i}`]} />
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addLine} className="btn-secondary w-full">
              + Add another line
            </button>

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Submitting…" : `Submit ${lines.length > 1 ? `${lines.length} lines` : "request"}`}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2">
          {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

          {/* Mobile card list */}
          <div className="space-y-3 md:hidden">
            {loading && <p className="card p-6 text-center text-slate-500">Loading requests…</p>}
            {!loading && rows.length === 0 && <p className="card p-6 text-center text-slate-500">No petty cash requests yet.</p>}
            {!loading && rows.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-slate-500">{r.requisition_no}</p>
                    {isAdmin && <p className="text-sm font-medium text-slate-800">{r.requester_name}</p>}
                    <p className="text-lg font-bold text-slate-900">KES {r.amount.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{r.purpose}</p>
                    <p className="text-xs text-slate-500">Needed {r.date_needed}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(isManager || r.requested_by === session.id) && r.status !== "pending" && r.status !== "rejected" && (
                    <a href={`/requisition/petty-cash/${r.id}`} target="_blank" className="btn-secondary btn-xs">Form</a>
                  )}
                  {isAdmin && r.status === "pending" && (
                    <>
                      <button onClick={() => setPendingAction({ id: r.id, action: "approve" })} className="btn-success btn-xs">Approve</button>
                      <button onClick={() => setPendingAction({ id: r.id, action: "reject" })} className="btn-danger btn-xs">Reject</button>
                    </>
                  )}
                  {isAdmin && r.status === "approved" && (
                    <button onClick={() => setPendingAction({ id: r.id, action: "paid" })} className="btn-primary btn-xs">Mark paid</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="card hidden overflow-x-auto md:block">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Ref</th>
                  {isAdmin && <th>Requested by</th>}
                  <th>Amount (KES)</th>
                  <th>Purpose</th>
                  <th>Needed by</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-slate-500">Loading requests…</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-slate-500">No petty cash requests yet.</td></tr>
                )}
                {!loading && rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.requisition_no}</td>
                    {isAdmin && <td className="font-medium">{r.requester_name}</td>}
                    <td>{r.amount.toLocaleString()}</td>
                    <td className="max-w-xs truncate" title={r.purpose}>{r.purpose}</td>
                    <td>{r.date_needed}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="space-x-1.5 whitespace-nowrap text-right">
                      {(isManager || r.requested_by === session.id) && r.status !== "pending" && r.status !== "rejected" && (
                        <a href={`/requisition/petty-cash/${r.id}`} target="_blank" className="btn-secondary btn-xs">Form</a>
                      )}
                      {isAdmin && r.status === "pending" && (
                        <>
                          <button onClick={() => setPendingAction({ id: r.id, action: "approve" })} className="btn-success btn-xs">Approve</button>
                          <button onClick={() => setPendingAction({ id: r.id, action: "reject" })} className="btn-danger btn-xs">Reject</button>
                        </>
                      )}
                      {isAdmin && r.status === "approved" && (
                        <button onClick={() => setPendingAction({ id: r.id, action: "paid" })} className="btn-primary btn-xs">Mark paid</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={!!pendingAction}
        title={
          pendingAction?.action === "approve" ? "Approve request"
          : pendingAction?.action === "reject" ? "Reject request"
          : "Mark as paid"
        }
        message={
          pendingAction?.action === "approve" ? "Approve this petty cash request? It will be posted to the ledger."
          : pendingAction?.action === "reject" ? "Reject this petty cash request?"
          : "Mark this request as paid? This records the cash payout."
        }
        confirmLabel={
          pendingAction?.action === "approve" ? "Approve"
          : pendingAction?.action === "reject" ? "Reject"
          : "Mark paid"
        }
        tone={pendingAction?.action === "reject" ? "danger" : "default"}
        busy={actionBusy}
        onConfirm={() => pendingAction && act(pendingAction.id, pendingAction.action)}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}
