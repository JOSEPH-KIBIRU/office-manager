"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Alert, FieldError, inputCls, Modal, api } from "@/components/ui";
import { validate, required, type Errors } from "@/lib/validation";

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  amount?: number;
}

interface ContactRow {
  id: string;
  type: "customer" | "supplier";
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  tin: string | null;
  created_at: string;
}

interface InvoiceRow {
  id: string;
  contact_id: string;
  contact_name: string;
  contact_company: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  contact_tin: string | null;
  number: string;
  issue_date: string;
  due_date: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  line_items: LineItem[];
  note: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  recurring_frequency: string | null;
  recurring_active: boolean;
  created_at: string;
  updated_at: string;
}

const FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;
const STATUS_FLOW: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["paid", "overdue", "cancelled"],
  paid: [],
  overdue: ["paid"],
  cancelled: [],
};

const fmtMoney = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoicesPage() {
  const session = useSession();
  const [tab, setTab] = useState<"invoices" | "contacts">("invoices");

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [deleting, setDeleting] = useState<InvoiceRow | null>(null);

  // invoice form
  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [frequency, setFrequency] = useState<string>("");
  const [recurringActive, setRecurringActive] = useState(false);
  const [items, setItems] = useState<LineItem[]>([{ description: "", qty: 1, unitPrice: 0, taxRate: 16 }]);
  const [errors, setErrors] = useState<Errors>({});

  // contact form
  const [cName, setCName] = useState("");
  const [cType, setCType] = useState<"customer" | "supplier">("customer");
  const [cCompany, setCCompany] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cTin, setCTin] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [contactErrors, setContactErrors] = useState<Errors>({});

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function loadInvoices() {
    try {
      const data = await api<{ invoices: InvoiceRow[] }>("/api/invoices");
      setInvoices(data.invoices);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    }
  }

  async function loadContacts() {
    try {
      const data = await api<{ contacts: ContactRow[] }>("/api/contacts");
      setContacts(data.contacts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contacts");
    }
  }

  useEffect(() => {
    loadInvoices();
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customers = contacts.filter((c) => c.type === "customer");
  const suppliers = contacts.filter((c) => c.type === "supplier");

  function setItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  const liveSubtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const liveTax = items.reduce((s, it) => s + it.qty * it.unitPrice * (it.taxRate / 100), 0);
  const liveTotal = liveSubtotal + liveTax;

  function resetInvoiceForm() {
    setEditing(null);
    setContactId("");
    setIssueDate("");
    setDueDate("");
    setNote("");
    setFrequency("");
    setRecurringActive(false);
    setItems([{ description: "", qty: 1, unitPrice: 0, taxRate: 16 }]);
    setErrors({});
  }

  function openNewInvoice() {
    resetInvoiceForm();
    setShowInvoiceModal(true);
  }

  function openEditInvoice(inv: InvoiceRow) {
    setEditing(inv);
    setContactId(inv.contact_id);
    setIssueDate(inv.issue_date);
    setDueDate(inv.due_date);
    setNote(inv.note ?? "");
    setFrequency(inv.recurring_frequency ?? "");
    setRecurringActive(inv.recurring_active);
    setItems(inv.line_items.map((it) => ({ description: it.description, qty: it.qty, unitPrice: it.unitPrice, taxRate: it.taxRate })));
    setErrors({});
    setShowInvoiceModal(true);
  }

  async function submitInvoice(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    const errs = validate(
      { contactId, issueDate, dueDate, items },
      {
        contactId: [required("Customer")],
        issueDate: [required("Issue date")],
        dueDate: [required("Due date")],
        items: [() => (items.length === 0 || items.some((it) => !it.description.trim() || !(it.qty > 0) || !(it.unitPrice > 0)) ? "Every line item needs a description, quantity and price" : null)],
      }
    );
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    const payload = {
      contactId,
      issueDate,
      dueDate,
      note: note || undefined,
      lineItems: items.map((it) => ({ description: it.description.trim(), qty: it.qty, unitPrice: it.unitPrice, taxRate: it.taxRate })),
      recurringFrequency: frequency || undefined,
      recurringActive,
    };
    try {
      if (editing) {
        await api(`/api/invoices/${editing.id}`, { method: "PATCH", json: payload });
        setNotice("Invoice updated.");
      } else {
        await api("/api/invoices", { method: "POST", json: payload });
        setNotice("Invoice created.");
      }
      setShowInvoiceModal(false);
      resetInvoiceForm();
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api(`/api/invoices/${id}/status`, { method: "PATCH", json: { status } });
      setNotice("Invoice status updated.");
      await loadInvoices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/invoices/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      setNotice("Invoice deleted.");
      await loadInvoices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // contacts
  function openNewContact(type: "customer" | "supplier") {
    setCType(type);
    setCName("");
    setCCompany("");
    setCEmail("");
    setCPhone("");
    setCTin("");
    setCAddress("");
    setContactErrors({});
    setShowContactModal(true);
  }

  function submitContact(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const errs = validate({ cName }, { cName: [required("Name")] });
    if (Object.keys(errs).length > 0) {
      setContactErrors(errs);
      setBusy(false);
      return;
    }
    setContactErrors({});
    try {
      api("/api/contacts", {
        method: "POST",
        json: { type: cType, name: cName, company: cCompany || undefined, email: cEmail || undefined, phone: cPhone || undefined, tin: cTin || undefined, address: cAddress || undefined },
      }).then(() => {
        setShowContactModal(false);
        setNotice(cType === "customer" ? "Customer added." : "Supplier added.");
        return loadContacts();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contact");
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact(id: string) {
    if (!confirm("Delete this contact? Invoices referencing it will show a blank name.")) return;
    try {
      await api(`/api/contacts/${id}`, { method: "DELETE" });
      setNotice("Contact deleted.");
      await loadContacts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Invoicing"
        subtitle="Create, send and track invoices; keep a directory of customers and suppliers."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <button onClick={() => setTab("invoices")} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === "invoices" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100 cursor-pointer"}`}>
            Invoices
          </button>
          <button onClick={() => setTab("contacts")} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === "contacts" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100 cursor-pointer"}`}>
            Contacts
          </button>
        </div>
        {tab === "invoices" ? (
          <button onClick={openNewInvoice} className="btn-primary ml-auto">New invoice</button>
        ) : (
          <div className="ml-auto flex gap-2">
            <button onClick={() => openNewContact("customer")} className="btn-primary">Add customer</button>
            <button onClick={() => openNewContact("supplier")} className="btn-secondary">Add supplier</button>
          </div>
        )}
      </div>

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      {tab === "invoices" && (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Total (KES)</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">No invoices yet. Create your first invoice.</td></tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-mono text-xs font-semibold text-indigo-600">{inv.number}</td>
                  <td>
                    <span className="font-medium">{inv.contact_name}</span>
                    {inv.contact_company && <div className="text-xs text-slate-500">{inv.contact_company}</div>}
                  </td>
                  <td>{inv.issue_date}</td>
                  <td>{inv.due_date}</td>
                  <td className="font-semibold">{fmtMoney(inv.total)}</td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td className="space-x-1.5 whitespace-nowrap text-right">
                    <a href={`/invoice/${inv.id}`} target="_blank" className="btn-secondary px-2 py-1 text-xs">Print</a>
                    <button onClick={() => openEditInvoice(inv)} className="btn-secondary px-2 py-1 text-xs">Edit</button>
                    {STATUS_FLOW[inv.status].map((s) => (
                      <button key={s} onClick={() => setStatus(inv.id, s)} className={`px-2 py-1 text-xs ${s === "cancelled" ? "btn-danger" : "btn-primary"}`}>{s === "sent" ? "Mark sent" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
                    ))}
                    <button onClick={() => setDeleting(inv)} className="btn-danger px-2 py-1 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "contacts" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[
            { label: "Customers", list: customers },
            { label: "Suppliers", list: suppliers },
          ].map(({ label, list }) => (
            <div key={label} className="card overflow-x-auto">
              <h2 className="mb-3 font-semibold">{label}</h2>
              <table className="table-base">
                <thead>
                  <tr><th>Name</th><th>Contact</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {list.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-slate-400">No {label.toLowerCase()} yet.</td></tr>
                  )}
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="font-medium">{c.company || c.name}</span>
                        <div className="text-xs text-slate-500">{c.name}</div>
                      </td>
                      <td className="text-xs">
                        {c.email && <div>{c.email}</div>}
                        {c.phone && <div>{c.phone}</div>}
                        {c.tin && <div className="text-slate-500">TIN: {c.tin}</div>}
                      </td>
                      <td className="text-right">
                        <button onClick={() => deleteContact(c.id)} className="btn-danger px-2 py-1 text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showInvoiceModal && (
        <Modal title={editing ? `Edit ${editing.number}` : "New invoice"} onClose={() => setShowInvoiceModal(false)}>
          <form onSubmit={submitInvoice} className="space-y-3">
            <div>
              <label className="label">Customer</label>
              <select className={inputCls(errors.contactId)} value={contactId} onChange={(e) => { setContactId(e.target.value); clearError("contactId"); }}>
                <option value="">Select a customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
              {customers.length === 0 && <p className="mt-1 text-xs text-amber-600">No customers yet. Add one in the Contacts tab.</p>}
              <FieldError msg={errors.contactId} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Issue date</label>
                <input type="date" className={inputCls(errors.issueDate)} value={issueDate} onChange={(e) => { setIssueDate(e.target.value); clearError("issueDate"); }} />
                <FieldError msg={errors.issueDate} />
              </div>
              <div>
                <label className="label">Due date</label>
                <input type="date" className={inputCls(errors.dueDate)} value={dueDate} onChange={(e) => { setDueDate(e.target.value); clearError("dueDate"); }} />
                <FieldError msg={errors.dueDate} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">Line items</label>
                <button type="button" onClick={() => setItems((p) => [...p, { description: "", qty: 1, unitPrice: 0, taxRate: 16 }])} className="text-xs font-medium text-indigo-600 hover:underline cursor-pointer">+ Add item</button>
              </div>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 p-2">
                    <input className="input mb-2" placeholder="Description" value={it.description} onChange={(ev) => setItem(idx, { description: ev.target.value })} />
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input" type="number" min="1" placeholder="Qty" value={it.qty} onChange={(ev) => setItem(idx, { qty: Number(ev.target.value) })} />
                      <input className="input" type="number" min="0" step="0.01" placeholder="Unit price" value={it.unitPrice} onChange={(ev) => setItem(idx, { unitPrice: Number(ev.target.value) })} />
                      <div className="flex gap-1">
                        <input className="input" type="number" min="0" max="100" value={it.taxRate} onChange={(ev) => setItem(idx, { taxRate: Number(ev.target.value) })} />
                        <span className="self-center text-xs text-slate-500">%</span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="self-center text-xs text-red-500 hover:underline cursor-pointer">✕</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <FieldError msg={errors.items} />
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>KES {fmtMoney(liveSubtotal)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>KES {fmtMoney(liveTax)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>KES {fmtMoney(liveTotal)}</span></div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={recurringActive} onChange={(e) => setRecurringActive(e.target.checked)} className="h-4 w-4" />
              Recurring invoice
            </label>
            {recurringActive && (
              <div>
                <label className="label">Frequency</label>
                <select className={inputCls()} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="">Select frequency…</option>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label">Note (optional)</label>
              <textarea className={inputCls()} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create invoice"}
            </button>
          </form>
        </Modal>
      )}

      {showContactModal && (
        <Modal title={`Add ${cType}`} onClose={() => setShowContactModal(false)}>
          <form onSubmit={submitContact} className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input className={inputCls(contactErrors.cName)} value={cName} onChange={(e) => { setCName(e.target.value); setContactErrors((p) => ({ ...p, cName: undefined })); }} />
              <FieldError msg={contactErrors.cName} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Company</label>
                <input className={inputCls()} value={cCompany} onChange={(e) => setCCompany(e.target.value)} />
              </div>
              <div>
                <label className="label">TIN (optional)</label>
                <input className={inputCls()} value={cTin} onChange={(e) => setCTin(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className={inputCls()} value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className={inputCls()} value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">Address</label>
              <input className={inputCls()} value={cAddress} onChange={(e) => setCAddress(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Add"}</button>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete invoice" onClose={() => setDeleting(null)}>
          <p className="mb-4 text-sm text-slate-600">Delete invoice <strong>{deleting.number}</strong>? This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} className="btn-secondary">Cancel</button>
            <button onClick={confirmDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}
