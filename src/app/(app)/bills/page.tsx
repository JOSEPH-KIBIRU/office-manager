"use client";

import { useEffect, useState, FormEvent } from "react";
import { PageHeader, StatusBadge, Alert, FieldError, inputCls, Modal, api } from "@/components/ui";
import { validate, required, minNum, type Errors } from "@/lib/validation";

interface ContactRow {
  id: string;
  type: "customer" | "supplier";
  name: string;
  company: string | null;
}

interface BillRow {
  id: string;
  contact_id: string;
  contact_name: string;
  contact_company: string | null;
  number: string;
  bill_date: string;
  due_date: string;
  amount: number;
  description: string | null;
  status: "pending" | "paid" | "overdue";
  paid_at: string | null;
  created_at: string;
}

const fmtMoney = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BillsPage() {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [suppliers, setSuppliers] = useState<ContactRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BillRow | null>(null);

  const [contactId, setContactId] = useState("");
  const [billDate, setBillDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function load() {
    try {
      const data = await api<{ bills: BillRow[] }>("/api/bills");
      setBills(data.bills);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bills");
    }
  }

  async function loadSuppliers() {
    try {
      const data = await api<{ contacts: ContactRow[] }>("/api/contacts?type=supplier");
      setSuppliers(data.contacts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suppliers");
    }
  }

  useEffect(() => {
    load();
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setContactId("");
    setBillDate("");
    setDueDate("");
    setAmount("");
    setDescription("");
    setErrors({});
    setShowModal(true);
  }

  function openEdit(b: BillRow) {
    setEditing(b);
    setContactId(b.contact_id);
    setBillDate(b.bill_date);
    setDueDate(b.due_date);
    setAmount(String(b.amount));
    setDescription(b.description ?? "");
    setErrors({});
    setShowModal(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const errs = validate(
      { contactId, billDate, dueDate, amount },
      {
        contactId: [required("Supplier")],
        billDate: [required("Bill date")],
        dueDate: [required("Due date")],
        amount: [required("Amount"), minNum(0.01, "Amount")],
      }
    );
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    setErrors({});
    const payload = {
      contactId,
      billDate,
      dueDate,
      amount: Number(amount),
      description: description || undefined,
    };
    try {
      if (editing) {
        await api(`/api/bills/${editing.id}`, { method: "PATCH", json: payload });
        setNotice("Bill updated.");
      } else {
        await api("/api/bills", { method: "POST", json: payload });
        setNotice("Bill added.");
      }
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bill");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api(`/api/bills/${id}/status`, { method: "PATCH", json: { status } });
      setNotice(status === "paid" ? "Bill marked as paid." : "Bill status updated.");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this bill?")) return;
    try {
      await api(`/api/bills/${id}`, { method: "DELETE" });
      setNotice("Bill deleted.");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const totals = bills.reduce(
    (acc, b) => {
      acc.total += b.amount;
      if (b.status === "pending" || b.status === "overdue") acc.pending += b.amount;
      return acc;
    },
    { total: 0, pending: 0 }
  );

  return (
    <>
      <PageHeader
        title="Accounts Payable"
        subtitle="Track supplier bills and utilities, and settle them."
        action={<button onClick={openNew} className="btn-primary">Add bill</button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Total bills</p>
          <p className="text-2xl font-bold">KES {fmtMoney(totals.total)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Outstanding</p>
          <p className="text-2xl font-bold text-amber-700">KES {fmtMoney(totals.pending)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Suppliers</p>
          <p className="text-2xl font-bold">{suppliers.length}</p>
        </div>
      </div>

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Supplier</th>
              <th>Bill date</th>
              <th>Due</th>
              <th>Amount (KES)</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-400">No bills yet. Add a supplier bill to get started.</td></tr>
            )}
            {bills.map((b) => (
              <tr key={b.id}>
                <td className="font-mono text-xs font-semibold text-indigo-600">{b.number}</td>
                <td>
                  <span className="font-medium">{b.contact_company || b.contact_name}</span>
                  {b.description && <div className="max-w-xs truncate text-xs text-slate-500" title={b.description}>{b.description}</div>}
                </td>
                <td>{b.bill_date}</td>
                <td>{b.due_date}</td>
                <td className="font-semibold">{fmtMoney(b.amount)}</td>
                <td>
                  <StatusBadge status={b.status} />
                  {b.paid_at && <div className="text-xs text-slate-400">Paid {b.paid_at}</div>}
                </td>
                <td className="space-x-1.5 whitespace-nowrap text-right">
                  {b.status === "paid" ? (
                    <button onClick={() => setStatus(b.id, "pending")} className="btn-secondary px-2 py-1 text-xs">Reopen</button>
                  ) : (
                    <>
                      <button onClick={() => setStatus(b.id, "paid")} className="btn-success px-2 py-1 text-xs">Mark paid</button>
                      {b.status !== "overdue" && <button onClick={() => setStatus(b.id, "overdue")} className="btn-secondary px-2 py-1 text-xs">Overdue</button>}
                    </>
                  )}
                  {b.status !== "paid" && <button onClick={() => openEdit(b)} className="btn-secondary px-2 py-1 text-xs">Edit</button>}
                  {b.status !== "paid" && <button onClick={() => remove(b.id)} className="btn-danger px-2 py-1 text-xs">Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? `Edit ${editing.number}` : "Add bill"} onClose={() => setShowModal(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Supplier</label>
              <select className={inputCls(errors.contactId)} value={contactId} onChange={(e) => { setContactId(e.target.value); clearError("contactId"); }}>
                <option value="">Select a supplier…</option>
                {suppliers.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
              {suppliers.length === 0 && <p className="mt-1 text-xs text-amber-600">No suppliers yet. Add one on the Invoicing → Contacts page.</p>}
              <FieldError msg={errors.contactId} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Bill date</label>
                <input type="date" className={inputCls(errors.billDate)} value={billDate} onChange={(e) => { setBillDate(e.target.value); clearError("billDate"); }} />
                <FieldError msg={errors.billDate} />
              </div>
              <div>
                <label className="label">Due date</label>
                <input type="date" className={inputCls(errors.dueDate)} value={dueDate} onChange={(e) => { setDueDate(e.target.value); clearError("dueDate"); }} />
                <FieldError msg={errors.dueDate} />
              </div>
            </div>
            <div>
              <label className="label">Amount (KES)</label>
              <input type="number" min="0.01" step="0.01" className={inputCls(errors.amount)} value={amount} onChange={(e) => { setAmount(e.target.value); clearError("amount"); }} />
              <FieldError msg={errors.amount} />
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <input className={inputCls()} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. October electricity" />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add bill"}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
