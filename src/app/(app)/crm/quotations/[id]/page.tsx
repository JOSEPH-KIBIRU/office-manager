"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, Alert, Modal, StatusBadge, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePermissions } from "@/components/usePermissions";
import QuotationItemsEditor, { draftFromItems, itemsPayload, quotationTotals, type DraftItem } from "@/components/crm/QuotationItemsEditor";

interface Item { description: string; qty: number; unitPrice: number; taxRate: number; }
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
  notes?: string;
  terms?: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  invoiceId?: string;
  items: Item[];
}
interface Company { _id: string; name: string; }

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const { modules, can } = usePermissions();

  const [q, setQ] = useState<Quotation | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [issueDate, setIssueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, co] = await Promise.all([
        api<{ quotation: Quotation | null }>(`/api/crm/quotations/${id}`),
        api<{ companies: Company[] }>("/api/crm/companies").catch(() => ({ companies: [] as Company[] })),
      ]);
      setQ(data.quotation);
      setCompanies(co.companies);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load quotation");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const companyName = (cid?: string) => companies.find((c) => c._id === cid)?.name ?? "—";
  const totals = quotationTotals(items);

  function openEdit() {
    if (!q) return;
    setIssueDate(q.issueDate);
    setValidUntil(q.validUntil ?? "");
    setCurrency(q.currency);
    setNotes(q.notes ?? "");
    setTerms(q.terms ?? "");
    setItems(draftFromItems(q.items));
    setEditOpen(true);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    const payloadItems = itemsPayload(items).filter((it) => it.description && it.qty > 0);
    if (payloadItems.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/crm/quotations/${id}`, {
        method: "PATCH",
        json: {
          issueDate,
          validUntil: validUntil || null,
          currency,
          notes,
          terms,
          items: payloadItems,
        },
      });
      toast.success("Quotation saved");
      setEditOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save quotation");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await api(`/api/crm/quotations/${id}/status`, { method: "PATCH", json: { status } });
      toast.success(`Quotation marked ${status}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    setBusy(true);
    try {
      const res = await api<{ invoiceId: string; created: boolean }>(`/api/crm/quotations/${id}/convert`, { method: "POST" });
      toast.success(res.created ? "Invoice created in Accounting (draft)." : "This quotation is already converted.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to convert quotation");
    } finally {
      setBusy(false);
    }
  }

  if (Array.isArray(modules) && !can("crm-quotations")) {
    return (
      <>
        <PageHeader title="Quotation" />
        <Alert kind="error">You do not have access to CRM quotations.</Alert>
      </>
    );
  }

  return (
    <>
      <div className="mb-2">
        <Link href="/crm/quotations" className="text-sm text-slate-500 hover:text-slate-700">← Quotations</Link>
      </div>
      <PageHeader
        title={q?.number ?? "Quotation"}
        subtitle={q ? `${companyName(q.companyId)} · issued ${q.issueDate}` : undefined}
        action={
          q ? (
            <div className="flex flex-wrap gap-2">
              {q.status === "draft" && <button className="btn-secondary px-3 py-2 text-sm" onClick={() => setStatus("sent")} disabled={busy}>Mark sent</button>}
              {q.status === "sent" && (
                <>
                  <button className="btn-success px-3 py-2 text-sm" onClick={() => setStatus("accepted")} disabled={busy}>Accept</button>
                  <button className="btn-danger px-3 py-2 text-sm" onClick={() => setStatus("rejected")} disabled={busy}>Reject</button>
                </>
              )}
              {q.status !== "converted" && q.status !== "expired" && (
                <button className="btn-secondary px-3 py-2 text-sm" onClick={() => setStatus("expired")} disabled={busy}>Expire</button>
              )}
              {q.status === "accepted" && !q.invoiceId && can("invoices") && (
                <button className="btn-primary px-3 py-2 text-sm" onClick={convert} disabled={busy}>Convert to invoice</button>
              )}
              {q.status !== "converted" && <button className="btn-secondary px-3 py-2 text-sm" onClick={openEdit}>Edit</button>}
            </div>
          ) : undefined
        }
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {loading && <p className="text-sm text-slate-500">Loading quotation…</p>}
      {!loading && !q && <Alert kind="error">Quotation not found.</Alert>}

      {q && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={q.status} />
              {q.validUntil && <span className="text-xs text-slate-500">Valid until {q.validUntil}</span>}
              {q.invoiceId && (
                <Link href="/invoices" className="text-sm font-semibold text-indigo-600 hover:underline">
                  View accounting invoice →
                </Link>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="table-base">
                <thead><tr><th>Description</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Tax %</th><th className="text-right">Line</th></tr></thead>
                <tbody>
                  {q.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.description}</td>
                      <td className="text-right">{it.qty}</td>
                      <td className="text-right">{it.unitPrice.toLocaleString()}</td>
                      <td className="text-right">{it.taxRate}%</td>
                      <td className="text-right">{(it.qty * it.unitPrice).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end gap-6 text-sm text-slate-600">
              <span>Subtotal <strong>{q.currency} {q.subtotal.toLocaleString()}</strong></span>
              <span>Tax <strong>{q.currency} {q.taxTotal.toLocaleString()}</strong></span>
              <span>Total <strong>{q.currency} {q.total.toLocaleString()}</strong></span>
            </div>
          </div>

          {(q.notes || q.terms) && (
            <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              {q.notes && <div><h3 className="text-xs font-semibold uppercase text-slate-400">Notes</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{q.notes}</p></div>}
              {q.terms && <div><h3 className="text-xs font-semibold uppercase text-slate-400">Terms</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{q.terms}</p></div>}
            </div>
          )}

          {q.status === "accepted" && !q.invoiceId && !can("invoices") && (
            <Alert kind="error">Accounting (invoicing) is not enabled for your role, so this quotation cannot be converted.</Alert>
          )}
        </div>
      )}

      {editOpen && (
        <Modal title="Edit quotation" onClose={() => setEditOpen(false)}>
          <form onSubmit={saveEdit} className="space-y-3">
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
              <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
