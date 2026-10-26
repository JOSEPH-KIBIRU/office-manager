"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { PageHeader, Alert, Modal, StatusBadge, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePermissions } from "@/components/usePermissions";
import QuotationItemsEditor, { itemsPayload, quotationTotals, type DraftItem } from "@/components/crm/QuotationItemsEditor";

interface Quotation {
  _id: string;
  number: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  status: string;
  issueDate: string;
  validUntil?: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
}
interface Company { _id: string; name: string; }
interface Contact { _id: string; name: string; companyId?: string; }
interface Deal { _id: string; title: string; }

const today = () => new Date().toISOString().slice(0, 10);
const newItem = (): DraftItem => ({ description: "", qty: "1", unitPrice: "", taxRate: "0" });

export default function QuotationsPage() {
  const toast = useToast();
  const { modules, can } = usePermissions();

  const [rows, setRows] = useState<Quotation[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [dealId, setDealId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [validUntil, setValidUntil] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<DraftItem[]>([newItem()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : "";
      const [q, co, ct, dl] = await Promise.all([
        api<{ quotations: Quotation[] }>(`/api/crm/quotations${qs}`),
        api<{ companies: Company[] }>("/api/crm/companies").catch(() => ({ companies: [] as Company[] })),
        api<{ contacts: Contact[] }>("/api/crm/contacts").catch(() => ({ contacts: [] as Contact[] })),
        api<{ deals: Deal[] }>("/api/crm/deals").catch(() => ({ deals: [] as Deal[] })),
      ]);
      setRows(q.quotations);
      setCompanies(co.companies);
      setContacts(ct.contacts);
      setDeals(dl.deals);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const companyName = (id?: string) => companies.find((c) => c._id === id)?.name ?? "—";
  const dealTitle = (id?: string) => deals.find((d) => d._id === id)?.title ?? "—";
  const totals = quotationTotals(items);

  function openNew() {
    setCompanyId("");
    setContactId("");
    setDealId("");
    setIssueDate(today());
    setValidUntil("");
    setCurrency("KES");
    setNotes("");
    setTerms("");
    setItems([newItem()]);
    setFormError(null);
    setOpen(true);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const payloadItems = itemsPayload(items).filter((it) => it.description && it.qty > 0);
    if (payloadItems.length === 0) {
      setFormError("Add at least one line item with a description and quantity");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api("/api/crm/quotations", {
        method: "POST",
        json: {
          companyId: companyId || undefined,
          contactId: contactId || undefined,
          dealId: dealId || undefined,
          issueDate,
          validUntil: validUntil || undefined,
          currency,
          notes: notes || undefined,
          terms: terms || undefined,
          items: payloadItems,
        },
      });
      toast.success("Quotation created");
      setOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create quotation");
    } finally {
      setBusy(false);
    }
  }

  if (Array.isArray(modules) && !can("crm-quotations")) {
    return (
      <>
        <PageHeader title="Quotations" />
        <Alert kind="error">You do not have access to CRM quotations.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Quotations"
        subtitle="Send quotes, then convert accepted ones into accounting invoices."
        action={<button className="btn-primary" onClick={openNew}>+ New quotation</button>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="converted">Converted</option>
        </select>
        <span className="text-xs text-slate-500">{rows.length} quotation(s)</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>Number</th><th>Company</th><th>Deal</th><th>Issued</th><th>Valid until</th><th className="text-right">Total</th><th>Status</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="py-8 text-center text-slate-500">Loading quotations…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-500">No quotations yet.</td></tr>
            )}
            {!loading && rows.map((q) => (
              <tr key={q._id}>
                <td className="font-medium">
                  <Link href={`/crm/quotations/${q._id}`} className="text-indigo-600 hover:underline">{q.number}</Link>
                </td>
                <td>{companyName(q.companyId)}</td>
                <td>{dealTitle(q.dealId)}</td>
                <td>{q.issueDate}</td>
                <td>{q.validUntil || "—"}</td>
                <td className="text-right">{q.currency} {q.total.toLocaleString()}</td>
                <td><StatusBadge status={q.status} /></td>
                <td className="text-right"><Link href={`/crm/quotations/${q._id}`} className="btn-secondary btn-xs">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title="New quotation" onClose={() => setOpen(false)}>
          <form onSubmit={create} className="space-y-3">
            {formError && <Alert kind="error">{formError}</Alert>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Company</label>
                <select className="input" value={companyId} onChange={(e) => { setCompanyId(e.target.value); setContactId(""); }}>
                  <option value="">— none —</option>
                  {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Contact</label>
                <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                  <option value="">— none —</option>
                  {contacts.filter((c) => !companyId || c.companyId === companyId).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Deal (optional)</label>
              <select className="input" value={dealId} onChange={(e) => setDealId(e.target.value)}>
                <option value="">— none —</option>
                {deals.map((d) => <option key={d._id} value={d._id}>{d.title}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Issue date</label><input className="input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required /></div>
              <div><label className="label">Valid until</label><input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
              <div><label className="label">Currency</label><input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
            </div>
            <div>
              <label className="label">Line items</label>
              <QuotationItemsEditor items={items} onChange={setItems} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div><label className="label">Terms</label><textarea className="input" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
            </div>
            <p className="text-xs text-slate-500">Total: <strong>{currency} {totals.total.toLocaleString()}</strong></p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Create quotation"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
