"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Modal, Alert, FieldError, inputCls, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { validate, required, minNum, type Errors } from "@/lib/validation";
import type { CarLogRow } from "@/lib/types";

const CATEGORIES = ["repair", "insurance", "service"] as const;

export default function CarLogsPage() {
  const session = useSession();
  const isAdmin = session.role === "admin";
  const [logs, setLogs] = useState<CarLogRow[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<CarLogRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingDecision, setPendingDecision] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const toast = useToast();

  const empty = {
    vehicle_reg: "",
    category: "repair" as (typeof CATEGORIES)[number],
    description: "",
    vendor: "",
    amount: "",
    log_date: new Date().toISOString().slice(0, 10),
  };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [editErrors, setEditErrors] = useState<Errors>({});

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ carLogs: CarLogRow[] }>("/api/car-logs");
      setLogs(data.carLogs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load car logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitNew(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const errs = validate(form, {
      vehicle_reg: [required("Vehicle registration")],
      description: [required("Description")],
      amount: [minNum(0, "Amount")],
      log_date: [required("Date")],
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    setErrors({});
    try {
      await api("/api/car-logs", {
        method: "POST",
        json: { ...form, amount: Number(form.amount) || 0 },
      });
      setShowNew(false);
      setForm({ ...empty, log_date: form.log_date });
      toast.success("Entry logged. It is now pending approval.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    setDecisionBusy(true);
    try {
      await api(`/api/car-logs/${id}`, { method: "PATCH", json: { action } });
      toast.success(action === "approve" ? "Entry approved." : "Entry rejected.");
      setPendingDecision(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setDecisionBusy(false);
    }
  }

  function clearEditError(field: string) {
    setEditErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const errs = validate(
      { vehicle_reg: editing.vehicle_reg, description: editing.description, amount: editing.amount },
      {
        vehicle_reg: [required("Vehicle registration")],
        description: [required("Description")],
        amount: [minNum(0, "Amount")],
      }
    );
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditErrors({});
    setBusy(true);
    try {
      await api(`/api/car-logs/${editing.id}`, {
        method: "PATCH",
        json: {
          vehicle_reg: editing.vehicle_reg,
          category: editing.category,
          description: editing.description,
          vendor: editing.vendor,
          amount: Number(editing.amount),
          log_date: editing.log_date,
        },
      });
      toast.success("Entry updated.");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const id = deletingId;
    if (!id) return;
    setDeleteBusy(true);
    try {
      await api(`/api/car-logs/${id}`, { method: "DELETE" });
      toast.success("Entry deleted.");
      setDeletingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Car Repairs & Insurance"
        subtitle="Log vehicle repairs, servicing and insurance. The director approves entries."
        action={<button className="btn-primary" onClick={() => setShowNew(true)}>+ New entry</button>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th className="hidden sm:table-cell">Ref</th>
              <th>Vehicle</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount (KES)</th>
              <th className="hidden sm:table-cell">Date</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-500">Loading entries…</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-500">No entries logged yet.</td></tr>
            )}
            {!loading && logs.map((c) => (
              <tr key={c.id}>
                <td className="hidden font-mono text-xs sm:table-cell">{c.requisition_no}</td>
                <td className="font-medium">{c.vehicle_reg}</td>
                <td><span className="badge bg-slate-100 capitalize text-slate-700">{c.category}</span></td>
                <td className="max-w-xs truncate" title={c.description}>{c.description}</td>
                <td>{c.amount.toLocaleString()}</td>
                <td className="hidden sm:table-cell">{c.log_date}</td>
                <td><StatusBadge status={c.status} /></td>
                <td className="space-x-1.5 whitespace-nowrap text-right">
                  {(c.status === "pending" || isAdmin) && (
                    <a href={`/requisition/car-log/${c.id}`} target="_blank" className="btn-secondary btn-xs">Requisition</a>
                  )}
                  {c.status === "pending" && (
                    <button onClick={() => setEditing(c)} className="btn-secondary btn-xs">Edit</button>
                  )}
                  {isAdmin && c.status === "pending" && (
                    <>
                      <button onClick={() => setPendingDecision({ id: c.id, action: "approve" })} className="btn-success btn-xs">Approve</button>
                      <button onClick={() => setPendingDecision({ id: c.id, action: "reject" })} className="btn-danger btn-xs">Reject</button>
                    </>
                  )}
                  {c.status !== "approved" && (
                    <button onClick={() => setDeletingId(c.id)} className="btn-secondary btn-xs text-red-600">Del</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <Modal title="Log car repair / insurance" onClose={() => setShowNew(false)}>
          <form onSubmit={submitNew} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="car-reg">Vehicle registration</label>
                <input id="car-reg" className={`${inputCls(errors.vehicle_reg)} uppercase`} placeholder="KDA 123A" value={form.vehicle_reg}
                  onChange={(e) => { setForm({ ...form, vehicle_reg: e.target.value }); clearError("vehicle_reg"); }} required />
                <FieldError msg={errors.vehicle_reg} />
              </div>
              <div>
                <label className="label" htmlFor="car-cat">Category</label>
                <select id="car-cat" className="input capitalize" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as CarLogRow["category"] })}>
                  {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="car-desc">Description of work / cover</label>
              <textarea id="car-desc" className={inputCls(errors.description)} value={form.description}
                onChange={(e) => { setForm({ ...form, description: e.target.value }); clearError("description"); }} required />
              <FieldError msg={errors.description} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="car-vendor">Garage / Insurer</label>
                <input id="car-vendor" className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="car-amount">Amount</label>
                <input id="car-amount" type="number" min="0" step="0.01" className={inputCls(errors.amount)} value={form.amount}
                  onChange={(e) => { setForm({ ...form, amount: e.target.value }); clearError("amount"); }} />
                <FieldError msg={errors.amount} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="car-date">Date</label>
              <input id="car-date" type="date" className="input" value={form.log_date}
                onChange={(e) => setForm({ ...form, log_date: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Saving…" : "Save entry"}
            </button>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.requisition_no}`} onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="care-reg">Vehicle registration</label>
                <input id="care-reg" className={`input uppercase ${editErrors.vehicle_reg ? "input-invalid" : ""}`} value={editing.vehicle_reg}
                  onChange={(e) => { setEditing({ ...editing, vehicle_reg: e.target.value }); clearEditError("vehicle_reg"); }} required />
                <FieldError msg={editErrors.vehicle_reg} />
              </div>
              <div>
                <label className="label" htmlFor="care-cat">Category</label>
                <select id="care-cat" className="input capitalize" value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value as CarLogRow["category"] })}>
                  {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="care-desc">Description</label>
              <textarea id="care-desc" className={`input min-h-20 ${editErrors.description ? "input-invalid" : ""}`} value={editing.description}
                onChange={(e) => { setEditing({ ...editing, description: e.target.value }); clearEditError("description"); }} required />
              <FieldError msg={editErrors.description} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="care-vendor">Vendor</label>
                <input id="care-vendor" className="input" value={editing.vendor ?? ""}
                  onChange={(e) => setEditing({ ...editing, vendor: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="care-amount">Amount</label>
                <input id="care-amount" type="number" className={`input ${editErrors.amount ? "input-invalid" : ""}`} value={editing.amount}
                  onChange={(e) => { setEditing({ ...editing, amount: Number(e.target.value) }); clearEditError("amount"); }} />
                <FieldError msg={editErrors.amount} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="care-date">Date</label>
              <input id="care-date" type="date" className="input" value={editing.log_date}
                onChange={(e) => setEditing({ ...editing, log_date: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>Save changes</button>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title="Delete entry"
        message="Delete this entry? This cannot be undone."
        busy={deleteBusy}
        onConfirm={remove}
        onCancel={() => setDeletingId(null)}
      />

      <ConfirmDialog
        open={!!pendingDecision}
        title={pendingDecision?.action === "approve" ? "Approve entry" : "Reject entry"}
        message={
          pendingDecision?.action === "approve"
            ? "Approve this car log entry? It will be posted to the ledger."
            : "Reject this car log entry?"
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
