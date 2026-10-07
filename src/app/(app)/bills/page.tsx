"use client";

import { useEffect, useState, FormEvent } from "react";
import { PageHeader, StatusBadge, Alert, FieldError, inputCls, Modal, ConfirmDialog, api } from "@/components/ui";
import ShareButton from "@/components/ShareButton";
import { useToast } from "@/components/toast";
import { validate, required, minNum, dateOrder, type Errors } from "@/lib/validation";

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
  vat_rate: number;
  net_amount: number;
  vat_amount: number;
  description: string | null;
  status: "draft" | "received" | "pending" | "partially_paid" | "paid" | "overdue" | "void";
  amount_paid: number;
  balance_due: number;
  cost_center_code?: string | null;
  project_id?: string | null;
  paid_at: string | null;
  created_at: string;
}

const fmtMoney = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BillsPage() {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [suppliers, setSuppliers] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BillRow | null>(null);

  const [contactId, setContactId] = useState("");
  const [billDate, setBillDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [vatRate, setVatRate] = useState("0");
  const [description, setDescription] = useState("");
  const [costCentres, setCostCentres] = useState<{ code: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ _id: string; name: string }[]>([]);
  const [costCentre, setCostCentre] = useState("");
  const [project, setProject] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const billGross = Number(amount) || 0;
  const billVatRate = Number(vatRate) || 0;
  const billVat = billVatRate > 0 ? Math.round((billGross - billGross / (1 + billVatRate / 100)) * 100) / 100 : 0;
  const billNet = Math.round((billGross - billVat) * 100) / 100;

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ bills: BillRow[] }>("/api/bills");
      setBills(data.bills);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bills");
    } finally {
      setLoading(false);
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
    api<{ costCentres: { code: string; name: string }[] }>("/api/management/cost-centres").then((d) => setCostCentres(d.costCentres ?? [])).catch(() => setCostCentres([]));
    api<{ projects: { _id: string; name: string }[] }>("/api/management/projects").then((d) => setProjects(d.projects ?? [])).catch(() => setProjects([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setContactId("");
    setBillDate("");
    setDueDate("");
    setAmount("");
    setVatRate("0");
    setDescription("");
    setCostCentre("");
    setProject("");
    setErrors({});
    setShowModal(true);
  }

  function openEdit(b: BillRow) {
    setEditing(b);
    setContactId(b.contact_id);
    setBillDate(b.bill_date);
    setDueDate(b.due_date);
    setAmount(String(b.amount));
    setVatRate(String(b.vat_rate ?? 0));
    setDescription(b.description ?? "");
    setCostCentre(b.cost_center_code ?? "");
    setProject(b.project_id ?? "");
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
        dueDate: [required("Due date"), dateOrder("billDate", "dueDate", "Due date", "bill date")],
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
      vatRate: Number(vatRate) || 0,
      description: description || undefined,
      costCenterCode: costCentre || undefined,
      projectId: project || undefined,
    };
    try {
      if (editing) {
        await api(`/api/bills/${editing.id}`, { method: "PATCH", json: payload });
        toast.success("Bill updated.");
      } else {
        await api("/api/bills", { method: "POST", json: payload });
        toast.success("Bill added.");
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
      toast.success("Bill status updated.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function remove() {
    const id = deletingId;
    if (!id) return;
    setDeleteBusy(true);
    try {
      await api(`/api/bills/${id}`, { method: "DELETE" });
      toast.success("Bill deleted.");
      setDeletingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  const totals = bills.reduce(
    (acc, b) => {
      acc.total += b.amount;
      if (b.status === "pending" || b.status === "overdue" || b.status === "partially_paid" || b.status === "received") {
        acc.pending += b.balance_due ?? b.amount;
      }
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

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Supplier</th>
              <th className="hidden sm:table-cell">Bill date</th>
              <th>Due</th>
              <th>Amount (KES)</th>
              <th>VAT</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-500">Loading bills…</td></tr>
            )}
            {!loading && bills.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-500">No bills yet. Add a supplier bill to get started.</td></tr>
            )}
            {!loading && bills.map((b) => (
              <tr key={b.id}>
                <td className="font-mono text-xs font-semibold text-indigo-600">{b.number}</td>
                <td>
                  <span className="font-medium">{b.contact_company || b.contact_name}</span>
                  {b.description && <div className="max-w-xs truncate text-xs text-slate-500" title={b.description}>{b.description}</div>}
                </td>
                <td className="hidden sm:table-cell">{b.bill_date}</td>
                <td>{b.due_date}</td>
                <td className="font-semibold">{fmtMoney(b.amount)}</td>
                <td className="text-slate-500">
                  {b.vat_amount > 0 ? <span title={`${b.vat_rate}% on ${fmtMoney(b.net_amount)}`}>{fmtMoney(b.vat_amount)}</span> : "—"}
                </td>
                <td>
                  <StatusBadge status={b.status} />
                  {b.paid_at && <div className="text-xs text-slate-500">Paid {b.paid_at}</div>}
                </td>
                <td className="space-x-1.5 whitespace-nowrap text-right">
                  <a href={`/bill/${b.id}`} target="_blank" className="btn-secondary btn-xs">⬇ Download</a>
                  <ShareButton url={`/bill/${b.id}`} title={`${b.contact_company || b.contact_name} — ${b.number}`} text={`Bill ${b.number} for KES ${fmtMoney(b.amount)}`} />
                  {(b.status === "pending" || b.status === "received" || b.status === "overdue" || b.status === "partially_paid") && (
                    <a href="/accounting/payments" className="btn-primary btn-xs">Pay</a>
                  )}
                  {b.status !== "void" && b.status !== "paid" && (
                    <button onClick={() => setStatus(b.id, "overdue")} className="btn-secondary btn-xs">Overdue</button>
                  )}
                  {(b.status === "pending" || b.status === "overdue") && (
                    <button onClick={() => setStatus(b.id, "void")} className="btn-danger btn-xs">Void</button>
                  )}
                  {b.amount_paid === 0 && (b.status === "pending" || b.status === "received") && (
                    <button onClick={() => openEdit(b)} className="btn-secondary btn-xs">Edit</button>
                  )}
                  {b.amount_paid === 0 && (b.status === "pending" || b.status === "received") && (
                    <button onClick={() => setDeletingId(b.id)} className="btn-danger btn-xs">Delete</button>
                  )}
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
              <label className="label" htmlFor="bl-supplier">Supplier</label>
              <select id="bl-supplier" className={inputCls(errors.contactId)} value={contactId} onChange={(e) => { setContactId(e.target.value); clearError("contactId"); }}>
                <option value="">Select a supplier…</option>
                {suppliers.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
              {suppliers.length === 0 && <p className="mt-1 text-xs text-amber-600">No suppliers yet. Add one on the Invoicing → Contacts page.</p>}
              <FieldError msg={errors.contactId} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="bl-date">Bill date</label>
                <input id="bl-date" type="date" className={inputCls(errors.billDate)} value={billDate} onChange={(e) => { setBillDate(e.target.value); clearError("billDate"); }} />
                <FieldError msg={errors.billDate} />
              </div>
              <div>
                <label className="label" htmlFor="bl-due">Due date</label>
                <input id="bl-due" type="date" className={inputCls(errors.dueDate)} value={dueDate} onChange={(e) => { setDueDate(e.target.value); clearError("dueDate"); }} />
                <FieldError msg={errors.dueDate} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="bl-amount">Amount (KES) — total incl. VAT</label>
              <input id="bl-amount" type="number" min="0.01" step="0.01" className={inputCls(errors.amount)} value={amount} onChange={(e) => { setAmount(e.target.value); clearError("amount"); }} />
              <FieldError msg={errors.amount} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="bl-vat">VAT rate</label>
                <select id="bl-vat" className="input" value={vatRate} onChange={(e) => setVatRate(e.target.value)}>
                  <option value="0">0% — no VAT</option>
                  <option value="16">16% — standard VAT</option>
                  <option value="8">8% — reduced</option>
                </select>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex justify-between text-slate-500"><span>Net</span><span>{fmtMoney(billNet)}</span></div>
                <div className="flex justify-between text-slate-500"><span>VAT input</span><span>{fmtMoney(billVat)}</span></div>
                <div className="flex justify-between font-semibold text-slate-800"><span>Total</span><span>{fmtMoney(Number(amount) || 0)}</span></div>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="bl-desc">Description (optional)</label>
              <input id="bl-desc" className={inputCls()} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. October electricity" />
            </div>
            {(costCentres.length > 0 || projects.length > 0) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="bl-cc">Cost centre (optional)</label>
                  <select id="bl-cc" className="input" value={costCentre} onChange={(e) => setCostCentre(e.target.value)}>
                    <option value="">— none —</option>
                    {costCentres.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="bl-prj">Project (optional)</label>
                  <select id="bl-prj" className="input" value={project} onChange={(e) => setProject(e.target.value)}>
                    <option value="">— none —</option>
                    {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add bill"}</button>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title="Delete bill"
        message="Delete this bill? This cannot be undone."
        busy={deleteBusy}
        onConfirm={remove}
        onCancel={() => setDeletingId(null)}
      />
    </>
  );
}
