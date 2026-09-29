"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Modal, Alert, FieldError, inputCls, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { validate, dateOrder, required, type Errors } from "@/lib/validation";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS, type LeaveRow, type LeaveType } from "@/lib/types";

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export default function LeavePage() {
  const session = useSession();
  const isAdmin = session.role === "admin";
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [editing, setEditing] = useState<LeaveRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingDecision, setPendingDecision] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [editErrors, setEditErrors] = useState<Errors>({});
  const toast = useToast();

  // apply form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  async function load(scope?: "mine") {
    setLoading(true);
    try {
      const data = await api<{ leaves: LeaveRow[]; leave_balance: number }>(
        scope ? "/api/leaves?scope=mine" : "/api/leaves"
      );
      setLeaves(data.leaves);
      setBalance(data.leave_balance);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leaves");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitApply(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const values = { startDate, endDate, reason };
    const errs = validate(values, {
      startDate: [required("Start date")],
      endDate: [required("End date"), dateOrder("startDate", "endDate", "End date", "start date")],
      reason: [required("Reason")],
    });
    const days = daysBetween(startDate, endDate);
    if (Object.keys(errs).length === 0 && days > 365) errs.endDate = "Leave cannot exceed 365 days";
    if (Object.keys(errs).length === 0 && balance !== null && days > balance) {
      errs.startDate = `You only have ${balance} leave day(s) left`;
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await api("/api/leaves", {
        method: "POST",
        json: { start_date: startDate, end_date: endDate, reason, leave_type: leaveType },
      });
      setShowApply(false);
      setStartDate("");
      setEndDate("");
      setLeaveType("annual");
      setReason("");
      toast.success("Leave application submitted. The director has been notified by email and SMS.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    setDecisionBusy(true);
    try {
      await api(`/api/leaves/${id}`, { method: "PATCH", json: { action } });
      toast.success(action === "approve" ? "Leave approved." : "Leave rejected.");
      setPendingDecision(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setDecisionBusy(false);
    }
  }

  async function deleteLeave() {
    const id = deletingId;
    if (!id) return;
    setDeleteBusy(true);
    try {
      await api(`/api/leaves/${id}`, { method: "DELETE" });
      toast.success("Leave request deleted. Any deducted days were restored.");
      setDeletingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  function clearEditError(field: string) {
    setEditErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const errs = validate(
      { startDate: editing.start_date, endDate: editing.end_date, reason: editing.reason },
      {
        startDate: [required("Start date")],
        endDate: [required("End date"), dateOrder("startDate", "endDate", "End date", "start date")],
        reason: [required("Reason")],
      }
    );
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditErrors({});
    setBusy(true);
    try {
      await api(`/api/leaves/${editing.id}`, {
        method: "PATCH",
        json: {
          start_date: editing.start_date,
          end_date: editing.end_date,
          reason: editing.reason,
          leave_type: editing.leave_type,
        },
      });
      setEditing(null);
      toast.success("Request updated and balances adjusted.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const requestedDays = daysBetween(startDate, endDate);

  return (
    <>
      <PageHeader
        title="Leave"
        subtitle="Annual entitlement is 21 days per year. Days are deducted as soon as you apply."
        action={<button className="btn-primary" onClick={() => setShowApply(true)}>+ Apply for leave</button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-slate-500">My remaining balance</p>
          <p className="mt-1 text-3xl font-bold text-blue-800">{balance ?? "…"} days</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Pending requests</p>
          <p className="mt-1 text-3xl font-bold">{leaves.filter((l) => l.status === "pending").length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Approved requests</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{leaves.filter((l) => l.status === "approved").length}</p>
        </div>
      </div>

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {!isAdmin && (
        <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          You can <strong>withdraw</strong> a request while it is still pending. Once approved or rejected, only
          the director/admin can amend it.
        </p>
      )}

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {loading && <p className="card p-6 text-center text-slate-500">Loading leave requests…</p>}
        {!loading && leaves.length === 0 && <p className="card p-6 text-center text-slate-500">No leave requests yet.</p>}
        {!loading && leaves.map((l) => (
          <div key={l.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {isAdmin && <p className="font-medium text-slate-800">{l.requester_name}</p>}
                <p className="text-sm text-slate-600">
                  {LEAVE_TYPE_LABELS[l.leave_type] ?? l.leave_type} · {l.days} day(s)
                </p>
                <p className="text-xs text-slate-500">{l.start_date} → {l.end_date}</p>
                <p className="mt-1 text-xs text-slate-500">{l.reason}</p>
              </div>
              <StatusBadge status={l.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {isAdmin ? (
                <>
                  {l.status === "pending" && (
                    <>
                      <button onClick={() => setPendingDecision({ id: l.id, action: "approve" })} className="btn-success btn-xs">Approve</button>
                      <button onClick={() => setPendingDecision({ id: l.id, action: "reject" })} className="btn-danger btn-xs">Reject</button>
                    </>
                  )}
                  <button onClick={() => setEditing(l)} className="btn-secondary btn-xs">Edit</button>
                  <button onClick={() => setDeletingId(l.id)} className="btn-secondary btn-xs text-red-600">Delete</button>
                </>
              ) : l.status === "pending" ? (
                <button onClick={() => setDeletingId(l.id)} className="btn-secondary btn-xs text-red-600">Withdraw</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="table-base">
          <thead>
            <tr>
              {isAdmin && <th>Employee</th>}
              <th>Type</th>
              <th>Period</th>
              <th>Days</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Approved by</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-slate-500">Loading leave requests…</td></tr>
            )}
            {!loading && leaves.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-slate-500">No leave requests yet.</td></tr>
            )}
            {!loading && leaves.map((l) => (
              <tr key={l.id}>
                {isAdmin && <td className="font-medium">{l.requester_name}</td>}
                <td><span className="badge bg-slate-100 text-slate-700 capitalize">{LEAVE_TYPE_LABELS[l.leave_type] ?? l.leave_type}</span></td>
                <td>{l.start_date} → {l.end_date}</td>
                <td>{l.days}</td>
                <td className="max-w-xs truncate" title={l.reason}>{l.reason}</td>
                <td><StatusBadge status={l.status} /></td>
                <td>{l.approver_name ?? "—"}</td>
                <td className="space-x-2 whitespace-nowrap text-right">
                  {isAdmin ? (
                    <>
                      {l.status === "pending" && (
                        <>
                          <button onClick={() => setPendingDecision({ id: l.id, action: "approve" })} className="btn-success btn-xs">Approve</button>
                          <button onClick={() => setPendingDecision({ id: l.id, action: "reject" })} className="btn-danger btn-xs">Reject</button>
                        </>
                      )}
                      <button onClick={() => setEditing(l)} className="btn-secondary btn-xs">Edit</button>
                      <button onClick={() => setDeletingId(l.id)} className="btn-secondary btn-xs text-red-600">Del</button>
                    </>
                  ) : l.status === "pending" ? (
                    <button onClick={() => setDeletingId(l.id)} className="btn-secondary btn-xs text-red-600">Withdraw</button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showApply && (
        <Modal title="Apply for leave" onClose={() => setShowApply(false)}>
          <form onSubmit={submitApply} className="space-y-4">
            <div>
              <label className="label">Type of leave</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LEAVE_TYPES.map((t) => (
                  <label
                    key={t}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      leaveType === t ? "border-blue-600 bg-blue-50 font-medium text-blue-800" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="leave_type"
                      checked={leaveType === t}
                      onChange={() => setLeaveType(t)}
                      className="accent-blue-700"
                    />
                    {LEAVE_TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="lv-start">Start date</label>
                <input id="lv-start" type="date" className={inputCls(errors.startDate)} value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setErrors((p) => ({ ...p, startDate: undefined })); }} required />
                <FieldError msg={errors.startDate} />
              </div>
              <div>
                <label className="label" htmlFor="lv-end">End date</label>
                <input id="lv-end" type="date" className={inputCls(errors.endDate)} value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setErrors((p) => ({ ...p, endDate: undefined })); }}
                  min={startDate} required />
                <FieldError msg={errors.endDate} />
              </div>
            </div>
            {requestedDays > 0 && (
              <p className={`text-sm ${requestedDays > (balance ?? 0) ? "text-red-600" : "text-slate-600"}`}>
                This request is <strong>{requestedDays} day(s)</strong>. Balance after approval:{" "}
                <strong>{Math.max((balance ?? 0) - requestedDays, 0)} day(s)</strong>.
              </p>
            )}
            <div>
              <label className="label" htmlFor="lv-reason">Reason</label>
              <textarea id="lv-reason" className={inputCls(errors.reason)} value={reason}
                onChange={(e) => { setReason(e.target.value); setErrors((p) => ({ ...p, reason: undefined })); }}
                placeholder="Briefly describe the reason for your leave" required />
              <FieldError msg={errors.reason} />
            </div>
            <p className="text-xs text-slate-500">
              On submission your balance is deducted immediately and the director receives an email and SMS notification.
            </p>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Submitting…" : "Submit application"}
            </button>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit leave #${editing.id} (${editing.requester_name})`} onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <label className="label">Type of leave</label>
              <select className="input" value={editing.leave_type}
                onChange={(e) => setEditing({ ...editing, leave_type: e.target.value as LeaveType })}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="lve-start">Start date</label>
                <input id="lve-start" type="date" className={inputCls(editErrors.startDate)} value={editing.start_date}
                  onChange={(e) => { setEditing({ ...editing, start_date: e.target.value }); clearEditError("startDate"); }} required />
                <FieldError msg={editErrors.startDate} />
              </div>
              <div>
                <label className="label" htmlFor="lve-end">End date</label>
                <input id="lve-end" type="date" className={inputCls(editErrors.endDate)} value={editing.end_date}
                  onChange={(e) => { setEditing({ ...editing, end_date: e.target.value }); clearEditError("endDate"); }} required />
                <FieldError msg={editErrors.endDate} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="lve-reason">Reason</label>
              <textarea id="lve-reason" className={inputCls(editErrors.reason)} value={editing.reason}
                onChange={(e) => { setEditing({ ...editing, reason: e.target.value }); clearEditError("reason"); }} required />
              <FieldError msg={editErrors.reason} />
            </div>
            <p className="text-xs text-slate-500">Changing the duration automatically adjusts the employee's leave balance.</p>
            <button type="submit" className="btn-primary w-full" disabled={busy}>Save changes</button>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title={isAdmin ? "Delete leave request" : "Withdraw leave request"}
        message={
          isAdmin
            ? "Delete this leave request? Any deducted days will be restored."
            : "Withdraw this pending request? Any deducted days will be restored."
        }
        confirmLabel={isAdmin ? "Delete" : "Withdraw"}
        busy={deleteBusy}
        onConfirm={deleteLeave}
        onCancel={() => setDeletingId(null)}
      />

      <ConfirmDialog
        open={!!pendingDecision}
        title={pendingDecision?.action === "approve" ? "Approve leave" : "Reject leave"}
        message={
          pendingDecision?.action === "approve"
            ? "Approve this leave request? The employee will be notified."
            : "Reject this leave request? The employee will be notified and any deducted days restored."
        }
        confirmLabel={pendingDecision?.action === "approve" ? "Approve" : "Reject"}
        tone={pendingDecision?.action === "reject" ? "danger" : "default"}
        busy={decisionBusy}
        onConfirm={() => pendingDecision && decide(pendingDecision.id, pendingDecision.action)}
        onCancel={() => setPendingDecision(null)}
      />
    </>
  );
}
