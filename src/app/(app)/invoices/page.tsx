"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Alert, FieldError, inputCls, Modal, ConfirmDialog, api } from "@/components/ui";
import ShareButton from "@/components/ShareButton";
import { useToast } from "@/components/toast";
import { validate, required, dateOrder, type Errors } from "@/lib/validation";

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
  status: "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled" | "void";
  line_items: LineItem[];
  note: string | null;
  payment_details: string | null;
  terms: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  recurring_frequency: string | null;
  recurring_active: boolean;
  created_at: string;
  updated_at: string;
  etims_status: "not_sent" | "pending" | "submitted" | "failed";
  etims_control_number: string | null;
}

const FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;
const STATUS_FLOW: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["overdue", "cancelled"],
  partially_paid: ["overdue", "cancelled"],
  paid: [],
  overdue: ["cancelled"],
  cancelled: [],
  void: [],
};

const fmtMoney = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoicesPage() {
  const session = useSession();
  const [tab, setTab] = useState<"invoices" | "contacts">("invoices");

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remindersBusy, setRemindersBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [deleting, setDeleting] = useState<InvoiceRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deletingContact, setDeletingContact] = useState<ContactRow | null>(null);
  const [contactDeleteBusy, setContactDeleteBusy] = useState(false);

  // invoice form
  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [terms, setTerms] = useState("");
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
    setLoadingInvoices(true);
    try {
      const data = await api<{ invoices: InvoiceRow[] }>("/api/invoices");
      setInvoices(data.invoices);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoadingInvoices(false);
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
    setPaymentDetails("");
    setTerms("");
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
    setPaymentDetails(inv.payment_details ?? "");
    setTerms(inv.terms ?? "");
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
        dueDate: [required("Due date"), dateOrder("issueDate", "dueDate", "Due date", "issue date")],
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
      paymentDetails: paymentDetails || undefined,
      terms: terms || undefined,
      lineItems: items.map((it) => ({ description: it.description.trim(), qty: it.qty, unitPrice: it.unitPrice, taxRate: it.taxRate })),
      recurringFrequency: frequency || undefined,
      recurringActive,
    };
    try {
      if (editing) {
        await api(`/api/invoices/${editing.id}`, { method: "PATCH", json: payload });
        toast.success("Invoice updated.");
      } else {
        await api("/api/invoices", { method: "POST", json: payload });
        toast.success("Invoice created.");
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
      toast.success("Invoice status updated.");
      await loadInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function submitEtims(id: string) {
    try {
      const res = await api<{ controlNumber: string }>(`/api/invoices/${id}/etims`, { method: "POST" });
      toast.success(res.controlNumber ? `Submitted to eTIMS — control no. ${res.controlNumber}` : "Submitted to eTIMS.");
      await loadInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "eTIMS submission failed");
      await loadInvoices();
    }
  }

  async function sendReminders() {
    setRemindersBusy(true);
    try {
      const res = await api<{ due: number; sent: number; skipped: number }>("/api/cron/invoice-reminders", {
        method: "POST",
      });
      if (res.due === 0) {
        toast.success("No overdue invoices to remind.");
      } else {
        toast.success(
          `Reminders sent: ${res.sent} of ${res.due}${res.skipped ? ` (${res.skipped} skipped — no contact details)` : ""}.`
        );
      }
      await loadInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reminders");
    } finally {
      setRemindersBusy(false);
    }
  }

  async function confirmDelete() {
    const inv = deleting;
    if (!inv) return;
    setDeleteBusy(true);
    try {
      await api(`/api/invoices/${inv.id}`, { method: "DELETE" });
      setDeleting(null);
      toast.success("Invoice deleted.");
      await loadInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
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
        toast.success(cType === "customer" ? "Customer added." : "Supplier added.");
        return loadContacts();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contact");
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact() {
    const c = deletingContact;
    if (!c) return;
    setContactDeleteBusy(true);
    try {
      await api(`/api/contacts/${c.id}`, { method: "DELETE" });
      toast.success("Contact deleted.");
      setDeletingContact(null);
      await loadContacts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setContactDeleteBusy(false);
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
          <div className="ml-auto flex gap-2">
            <button onClick={sendReminders} disabled={remindersBusy} className="btn-secondary">
              {remindersBusy ? "Sending…" : "Send reminders"}
            </button>
            <button onClick={openNewInvoice} className="btn-primary">New invoice</button>
          </div>
        ) : (
          <div className="ml-auto flex gap-2">
            <button onClick={() => openNewContact("customer")} className="btn-primary">Add customer</button>
            <button onClick={() => openNewContact("supplier")} className="btn-secondary">Add supplier</button>
          </div>
        )}
      </div>

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {tab === "invoices" && (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th className="hidden sm:table-cell">Issued</th>
                <th>Due</th>
                <th>Total (KES)</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingInvoices && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500">Loading invoices…</td></tr>
              )}
              {!loadingInvoices && invoices.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500">No invoices yet. Create your first invoice.</td></tr>
              )}
              {!loadingInvoices && invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-mono text-xs font-semibold text-indigo-600">{inv.number}</td>
                  <td>
                    <span className="font-medium">{inv.contact_name}</span>
                    {inv.contact_company && <div className="text-xs text-slate-500">{inv.contact_company}</div>}
                  </td>
                  <td className="hidden sm:table-cell">{inv.issue_date}</td>
                  <td>{inv.due_date}</td>
                  <td className="font-semibold">{fmtMoney(inv.total)}</td>
                  <td>
                    <StatusBadge status={inv.status} />
                    {inv.etims_status === "submitted" && (
                      <div className="mt-1 text-[10px] font-semibold text-emerald-700" title={inv.etims_control_number ?? ""}>
                        eTIMS ✓ {inv.etims_control_number}
                      </div>
                    )}
                    {inv.etims_status === "pending" && <div className="mt-1 text-[10px] font-semibold text-amber-600">eTIMS…</div>}
                    {inv.etims_status === "failed" && <div className="mt-1 text-[10px] font-semibold text-red-600">eTIMS failed</div>}
                  </td>
                  <td className="space-x-1.5 whitespace-nowrap text-right">
                    <a href={`/invoice/${inv.id}`} target="_blank" className="btn-secondary btn-xs">⬇ Download</a>
                    <ShareButton url={`/invoice/${inv.id}`} title={`Invoice ${inv.number}`} text={`Invoice ${inv.number} for KES ${fmtMoney(inv.total)}`} />
                    <button onClick={() => openEditInvoice(inv)} className="btn-secondary btn-xs">Edit</button>
                    {(inv.etims_status === "not_sent" || inv.etims_status === "failed") && inv.status !== "draft" && inv.status !== "cancelled" && (
                      <button onClick={() => submitEtims(inv.id)} className="btn-secondary btn-xs" title="Submit to KRA eTIMS">eTIMS</button>
                    )}
                    {(inv.status === "sent" || inv.status === "overdue" || inv.status === "partially_paid") && (
                      <a href="/accounting/receipts" className="btn-primary btn-xs">Receive</a>
                    )}
                    {STATUS_FLOW[inv.status].map((s) => (
                      <button key={s} onClick={() => setStatus(inv.id, s)} className={`px-2 py-1 text-xs ${s === "cancelled" ? "btn-danger" : "btn-secondary"}`}>{s === "sent" ? "Mark sent" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
                    ))}
                    <button onClick={() => setDeleting(inv)} className="btn-danger btn-xs">Delete</button>
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
                        <button onClick={() => setDeletingContact(c)} className="btn-danger btn-xs">Delete</button>
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
              <label className="label" htmlFor="inv-customer">Customer</label>
              <select id="inv-customer" className={inputCls(errors.contactId)} value={contactId} onChange={(e) => { setContactId(e.target.value); clearError("contactId"); }}>
                <option value="">Select a customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
              {customers.length === 0 && <p className="mt-1 text-xs text-amber-600">No customers yet. Add one in the Contacts tab.</p>}
              <FieldError msg={errors.contactId} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="inv-issue">Issue date</label>
                <input id="inv-issue" type="date" className={inputCls(errors.issueDate)} value={issueDate} onChange={(e) => { setIssueDate(e.target.value); clearError("issueDate"); }} />
                <FieldError msg={errors.issueDate} />
              </div>
              <div>
                <label className="label" htmlFor="inv-due">Due date</label>
                <input id="inv-due" type="date" className={inputCls(errors.dueDate)} value={dueDate} onChange={(e) => { setDueDate(e.target.value); clearError("dueDate"); }} />
                <FieldError msg={errors.dueDate} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">Line items</label>
                <button type="button" onClick={() => setItems((p) => [...p, { description: "", qty: 1, unitPrice: 0, taxRate: 16 }])} className="text-xs font-medium text-indigo-600 hover:underline cursor-pointer">+ Add item</button>
              </div>
              <p className="mb-2 text-xs text-slate-500">Tax % is the VAT rate for each line — 16% standard, 0% for zero-rated or exempt.</p>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 p-2">
                    <input className="input mb-2" aria-label="Line description" placeholder="Description" value={it.description} onChange={(ev) => setItem(idx, { description: ev.target.value })} />
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input" type="number" min="1" placeholder="Qty" value={it.qty} onChange={(ev) => setItem(idx, { qty: Number(ev.target.value) })} />
                      <input className="input" type="number" min="0" step="0.01" placeholder="Unit price" value={it.unitPrice} onChange={(ev) => setItem(idx, { unitPrice: Number(ev.target.value) })} />
                      <div className="flex gap-1">
                        <input className="input" type="number" min="0" max="100" aria-label="Tax rate (%)" placeholder="Tax %" value={it.taxRate} onChange={(ev) => setItem(idx, { taxRate: Number(ev.target.value) })} />
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
                <label className="label" htmlFor="inv-freq">Frequency</label>
                <select id="inv-freq" className={inputCls()} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="">Select frequency…</option>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label" htmlFor="inv-pay">Payment instructions (optional)</label>
              <textarea
                id="inv-pay"
                className={inputCls()}
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                rows={3}
                placeholder="Leave blank to use your company default payment details"
              />
            </div>

            <div>
              <label className="label" htmlFor="inv-note">Note (optional)</label>
              <textarea
                id="inv-note"
                className={inputCls()}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Leave blank to use your company default note"
              />
            </div>

            <div>
              <label className="label" htmlFor="inv-terms">Terms &amp; conditions (optional)</label>
              <textarea
                id="inv-terms"
                className={inputCls()}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
                placeholder="Leave blank to use your company default terms"
              />
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
              <label className="label" htmlFor="ct-name">Name</label>
              <input id="ct-name" className={inputCls(contactErrors.cName)} value={cName} onChange={(e) => { setCName(e.target.value); setContactErrors((p) => ({ ...p, cName: undefined })); }} />
              <FieldError msg={contactErrors.cName} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ct-company">Company</label>
                <input id="ct-company" className={inputCls()} value={cCompany} onChange={(e) => setCCompany(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="ct-tin">TIN (optional)</label>
                <input id="ct-tin" className={inputCls()} value={cTin} onChange={(e) => setCTin(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="ct-email">Email</label>
              <input id="ct-email" type="email" className={inputCls()} value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ct-phone">Phone</label>
              <input id="ct-phone" className={inputCls()} value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ct-address">Address</label>
              <input id="ct-address" className={inputCls()} value={cAddress} onChange={(e) => setCAddress(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Add"}</button>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete invoice"
        message={<span>Delete invoice <strong>{deleting?.number}</strong>? This cannot be undone.</span>}
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={!!deletingContact}
        title="Delete contact"
        message="Delete this contact? Invoices referencing it will show a blank name."
        busy={contactDeleteBusy}
        onConfirm={deleteContact}
        onCancel={() => setDeletingContact(null)}
      />
    </>
  );
}
