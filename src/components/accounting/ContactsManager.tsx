"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, Modal, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Contact {
  id: string;
  type: "customer" | "supplier";
  number: string | null;
  name: string;
  legalName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  tin: string | null;
  paymentTerms: number | null;
  creditLimit: number | null;
  notes: string | null;
  active: boolean;
}

interface LedgerRow {
  date: string;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const empty = {
  name: "",
  legalName: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  tin: "",
  paymentTerms: "",
  creditLimit: "",
  notes: "",
};

export default function ContactsManager({ type }: { type: "customer" | "supplier" }) {
  const isCustomer = type === "customer";
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; form: typeof empty } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ledgerFor, setLedgerFor] = useState<Contact | null>(null);
  const [ledger, setLedger] = useState<{ rows: LedgerRow[]; closingBalance: number } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await api<{ contacts: Contact[] }>(`/api/contacts?type=${type}`);
      setContacts(d.contacts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setEditing({ id: null, form: { ...empty } });
  }
  function openEdit(c: Contact) {
    setEditing({
      id: c.id,
      form: {
        name: c.name,
        legalName: c.legalName ?? "",
        contactPerson: c.contactPerson ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        address: c.address ?? "",
        tin: c.tin ?? "",
        paymentTerms: c.paymentTerms != null ? String(c.paymentTerms) : "",
        creditLimit: c.creditLimit != null ? String(c.creditLimit) : "",
        notes: c.notes ?? "",
      },
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const json = {
      type,
      name: editing.form.name,
      legalName: editing.form.legalName,
      contactPerson: editing.form.contactPerson,
      email: editing.form.email,
      phone: editing.form.phone,
      address: editing.form.address,
      tin: editing.form.tin,
      paymentTerms: editing.form.paymentTerms === "" ? undefined : Number(editing.form.paymentTerms),
      creditLimit: editing.form.creditLimit === "" ? undefined : Number(editing.form.creditLimit),
      notes: editing.form.notes,
    };
    try {
      if (editing.id) {
        await api(`/api/contacts/${editing.id}`, { method: "PATCH", json });
        toast.success("Saved.");
      } else {
        await api("/api/contacts", { method: "POST", json });
        toast.success(`${isCustomer ? "Customer" : "Supplier"} created.`);
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function openLedger(c: Contact) {
    setLedgerFor(c);
    setLedger(null);
    try {
      const d = await api<{ rows: LedgerRow[]; closingBalance: number }>(
        `/api/accounting/contact-ledger?contactId=${c.id}`
      );
      setLedger({ rows: d.rows, closingBalance: d.closingBalance });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ledger");
    }
  }

  const filtered = contacts.filter(
    (c) => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()) || (c.number ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCustomer ? "Customers" : "Suppliers"}
        subtitle={
          isCustomer
            ? "Customer records linked to Accounts Receivable. Open a customer to view their statement of account."
            : "Supplier records linked to Accounts Payable. Open a supplier to view their statement of account."
        }
      />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn-primary ml-auto" onClick={openNew}>
          + New {isCustomer ? "customer" : "supplier"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="card p-6 text-sm text-slate-400">No {isCustomer ? "customers" : "suppliers"} yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">KRA PIN</th>
                <th className="px-4 py-3">Terms</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-mono text-slate-500">{c.number ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{c.name}</p>
                    {c.legalName && <p className="text-xs text-slate-400">{c.legalName}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.contactPerson && <p>{c.contactPerson}</p>}
                    {c.phone && <p className="text-xs">{c.phone}</p>}
                    {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.tin ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.paymentTerms != null ? `${c.paymentTerms} days` : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button className="btn-secondary btn-xs" onClick={() => openLedger(c)}>Statement</button>
                      <button className="btn-secondary btn-xs" onClick={() => openEdit(c)}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? "Edit" : `New ${isCustomer ? "customer" : "supplier"}`} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input className={inputCls()} value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} />
            </div>
            <div>
              <label className="label">Legal / business name</label>
              <input className={inputCls()} value={editing.form.legalName} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, legalName: e.target.value } })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Contact person</label>
                <input className={inputCls()} value={editing.form.contactPerson} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, contactPerson: e.target.value } })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className={inputCls()} value={editing.form.phone} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, phone: e.target.value } })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input className={inputCls()} value={editing.form.email} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, email: e.target.value } })} />
              </div>
              <div>
                <label className="label">KRA PIN</label>
                <input className={inputCls()} value={editing.form.tin} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, tin: e.target.value } })} />
              </div>
            </div>
            <div>
              <label className="label">Billing address</label>
              <input className={inputCls()} value={editing.form.address} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, address: e.target.value } })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Payment terms (days)</label>
                <input type="number" className={inputCls()} value={editing.form.paymentTerms} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, paymentTerms: e.target.value } })} />
              </div>
              <div>
                <label className="label">Credit limit</label>
                <input type="number" className={inputCls()} value={editing.form.creditLimit} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, creditLimit: e.target.value } })} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className={inputCls()} rows={2} value={editing.form.notes} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, notes: e.target.value } })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </Modal>
      )}

      {ledgerFor && (
        <Modal title={`${ledgerFor.name} — statement of account`} onClose={() => setLedgerFor(null)}>
          {!ledger ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : ledger.rows.length === 0 ? (
            <p className="text-sm text-slate-400">No transactions yet.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Reference</th>
                    <th className="py-2 pr-2">Description</th>
                    <th className="py-2 pl-2 text-right">Debit</th>
                    <th className="py-2 pl-2 text-right">Credit</th>
                    <th className="py-2 pl-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">{r.date}</td>
                      <td className="py-1.5 pr-2 font-mono text-xs text-slate-600">{r.ref}</td>
                      <td className="py-1.5 pr-2 text-slate-600">{r.description}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{r.debit ? fmtKsh(r.debit) : ""}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{r.credit ? fmtKsh(r.credit) : ""}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums font-medium">{fmtKsh(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-right text-sm font-semibold text-slate-700">
                Closing balance: {fmtKsh(ledger.closingBalance)}
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
