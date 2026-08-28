"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Modal, Alert, FieldError, inputCls, api } from "@/components/ui";
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

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function load() {
    try {
      const data = await api<{ carLogs: CarLogRow[] }>("/api/car-logs");
      setLogs(data.carLogs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load car logs");
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    const note = action === "reject" ? prompt("Reason for rejection (optional):") ?? "" : "";
    try {
      await api(`/api/car-logs/${id}`, { method: "PATCH", json: { action, note: note || undefined } });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
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
      alert(Object.values(errs)[0]);
      return;
    }
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
      setEditing(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    try {
      await api(`/api/car-logs/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
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
              <th>Ref</th>
              <th>Vehicle</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount (KES)</th>
              <th>Date</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">No entries logged yet.</td></tr>
            )}
            {logs.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-xs">{c.requisition_no}</td>
                <td className="font-medium">{c.vehicle_reg}</td>
                <td><span className="badge bg-slate-100 capitalize text-slate-700">{c.category}</span></td>
                <td className="max-w-xs truncate" title={c.description}>{c.description}</td>
                <td>{c.amount.toLocaleString()}</td>
                <td>{c.log_date}</td>
                <td><StatusBadge status={c.status} /></td>
                <td className="space-x-1.5 whitespace-nowrap text-right">
                  {(c.status === "pending" || isAdmin) && (
                    <a href={`/requisition/car-log/${c.id}`} target="_blank" className="btn-secondary px-2 py-1 text-xs">Requisition</a>
                  )}
                  {c.status === "pending" && (
                    <button onClick={() => setEditing(c)} className="btn-secondary px-2 py-1 text-xs">Edit</button>
                  )}
                  {isAdmin && c.status === "pending" && (
                    <>
                      <button onClick={() => decide(c.id, "approve")} className="btn-success px-2 py-1 text-xs">Approve</button>
                      <button onClick={() => decide(c.id, "reject")} className="btn-danger px-2 py-1 text-xs">Reject</button>
                    </>
                  )}
                  {c.status !== "approved" && (
                    <button onClick={() => remove(c.id)} className="btn-secondary px-2 py-1 text-xs text-red-600">Del</button>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Vehicle registration</label>
                <input className={`${inputCls(errors.vehicle_reg)} uppercase`} placeholder="KDA 123A" value={form.vehicle_reg}
                  onChange={(e) => { setForm({ ...form, vehicle_reg: e.target.value }); clearError("vehicle_reg"); }} required />
                <FieldError msg={errors.vehicle_reg} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input capitalize" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as CarLogRow["category"] })}>
                  {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Description of work / cover</label>
              <textarea className={inputCls(errors.description)} value={form.description}
                onChange={(e) => { setForm({ ...form, description: e.target.value }); clearError("description"); }} required />
              <FieldError msg={errors.description} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="label">Garage / Insurer</label>
                <input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
              </div>
              <div>
                <label className="label">Amount</label>
                <input type="number" min="0" step="0.01" className={inputCls(errors.amount)} value={form.amount}
                  onChange={(e) => { setForm({ ...form, amount: e.target.value }); clearError("amount"); }} />
                <FieldError msg={errors.amount} />
              </div>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.log_date}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Vehicle registration</label>
                <input className="input uppercase" value={editing.vehicle_reg}
                  onChange={(e) => setEditing({ ...editing, vehicle_reg: e.target.value })} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input capitalize" value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value as CarLogRow["category"] })}>
                  {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input min-h-20" value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="label">Vendor</label>
                <input className="input" value={editing.vendor ?? ""}
                  onChange={(e) => setEditing({ ...editing, vendor: e.target.value })} />
              </div>
              <div>
                <label className="label">Amount</label>
                <input type="number" className="input" value={editing.amount}
                  onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={editing.log_date}
                onChange={(e) => setEditing({ ...editing, log_date: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>Save changes</button>
          </form>
        </Modal>
      )}
    </>
  );
}
