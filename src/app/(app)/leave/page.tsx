"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Modal, Alert, FieldError, inputCls, api } from "@/components/ui";
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
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // apply form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  async function load(scope?: "mine") {
    try {
      const data = await api<{ leaves: LeaveRow[]; leave_balance: number }>(
        scope ? "/api/leaves?scope=mine" : "/api/leaves"
      );
      setLeaves(data.leaves);
      setBalance(data.leave_balance);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leaves");
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
      setNotice("Leave application submitted. The director has been notified by email and SMS.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    const note = action === "reject" ? prompt("Reason for rejection (optional):") ?? "" : "";
    try {
      await api(`/api/leaves/${id}`, { method: "PATCH", json: { action, admin_note: note || undefined } });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function deleteLeave(id: string) {
    if (!confirm("Delete this leave request? Any deducted days will be restored.")) return;
    try {
      await api(`/api/leaves/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
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
      alert(Object.values(errs)[0]);
      return;
    }
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
      setNotice("Request updated and balances adjusted.");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
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
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      {!isAdmin && (
        <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          Submitted applications are locked and cannot be edited. Only the director/admin can amend them.
        </p>
      )}

      <div className="card overflow-x-auto">
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
              {isAdmin && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 7} className="text-center text-slate-400 py-8">No leave requests yet.</td></tr>
            )}
            {leaves.map((l) => (
              <tr key={l.id}>
                {isAdmin && <td className="font-medium">{l.requester_name}</td>}
                <td><span className="badge bg-slate-100 text-slate-700 capitalize">{LEAVE_TYPE_LABELS[l.leave_type] ?? l.leave_type}</span></td>
                <td>{l.start_date} → {l.end_date}</td>
                <td>{l.days}</td>
                <td className="max-w-xs truncate" title={l.reason}>{l.reason}</td>
                <td><StatusBadge status={l.status} /></td>
                <td>{l.approver_name ?? "—"}</td>
                {isAdmin && (
                  <td className="space-x-2 text-right whitespace-nowrap">
                    {l.status === "pending" && (
                      <>
                        <button onClick={() => decide(l.id, "approve")} className="btn-success px-2.5 py-1 text-xs">Approve</button>
                        <button onClick={() => decide(l.id, "reject")} className="btn-danger px-2.5 py-1 text-xs">Reject</button>
                      </>
                    )}
                    <button onClick={() => setEditing(l)} className="btn-secondary px-2.5 py-1 text-xs">Edit</button>
                    <button onClick={() => deleteLeave(l.id)} className="btn-secondary px-2.5 py-1 text-xs text-red-600">Del</button>
                  </td>
                )}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start date</label>
                <input type="date" className={inputCls(errors.startDate)} value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setErrors((p) => ({ ...p, startDate: undefined })); }} required />
                <FieldError msg={errors.startDate} />
              </div>
              <div>
                <label className="label">End date</label>
                <input type="date" className={inputCls(errors.endDate)} value={endDate}
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
              <label className="label">Reason</label>
              <textarea className={inputCls(errors.reason)} value={reason}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start date</label>
                <input type="date" className="input" value={editing.start_date}
                  onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
              </div>
              <div>
                <label className="label">End date</label>
                <input type="date" className="input" value={editing.end_date}
                  onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Reason</label>
              <textarea className="input min-h-20" value={editing.reason}
                onChange={(e) => setEditing({ ...editing, reason: e.target.value })} />
            </div>
            <p className="text-xs text-slate-500">Changing the duration automatically adjusts the employee's leave balance.</p>
            <button type="submit" className="btn-primary w-full" disabled={busy}>Save changes</button>
          </form>
        </Modal>
      )}
    </>
  );
}
