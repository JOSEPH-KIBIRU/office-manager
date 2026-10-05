"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, Modal, ConfirmDialog, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Row {
  id: string;
  kind: "receipt" | "payment";
  contactId: string;
  contactName: string;
  date: string;
  amount: number;
  method: string;
  reference: string | null;
  allocated: number;
  unallocated: number;
  createdByName: string | null;
}

interface Contact {
  id: string;
  name: string;
}

interface OpenItem {
  id: string;
  number: string;
  dueDate: string;
  balanceDue: number;
  status: string;
}

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

export default function SubledgerPage({ kind }: { kind: "receipt" | "payment" }) {
  const isReceipt = kind === "receipt";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [voidFor, setVoidFor] = useState<Row | null>(null);

  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bank" | "mpesa" | "cash">("bank");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OpenItem[]>([]);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await api<Record<string, Row[]>>(`/api/accounting/${isReceipt ? "receipts" : "payments"}`);
      setRows(d[isReceipt ? "receipts" : "payments"]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [isReceipt]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    api<{ contacts: Contact[] }>(`/api/contacts?type=${isReceipt ? "customer" : "supplier"}`)
      .then((d) => setContacts(d.contacts))
      .catch(() => setContacts([]));
  }, [open, isReceipt]);

  async function loadItems(cid: string) {
    setContactId(cid);
    setItems([]);
    setAlloc({});
    if (!cid) return;
    try {
      const d = await api<{ items: OpenItem[] }>(
        `/api/accounting/open-items?kind=${isReceipt ? "invoice" : "bill"}&contactId=${cid}`
      );
      setItems(d.items);
      const next: Record<string, string> = {};
      for (const it of d.items) next[it.id] = "";
      setAlloc(next);
    } catch {
      setItems([]);
    }
  }

  const allocTotal = useMemo(
    () => Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0),
    [alloc]
  );

  function resetForm() {
    setContactId("");
    setDate(today());
    setAmount("");
    setMethod("bank");
    setReference("");
    setNotes("");
    setItems([]);
    setAlloc({});
  }

  async function submit() {
    if (!contactId || !amount || Number(amount) <= 0) {
      setError("Select a contact and enter an amount.");
      return;
    }
    if (allocTotal > Number(amount) + 0.5) {
      setError("Allocations cannot exceed the amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const allocations = Object.entries(alloc)
      .filter(([, v]) => Number(v) > 0)
      .map(([id, v]) => (isReceipt ? { invoiceId: id, amount: Number(v) } : { billId: id, amount: Number(v) }));
    try {
      await api(`/api/accounting/${isReceipt ? "receipts" : "payments"}`, {
        method: "POST",
        json: { contactId, date, amount: Number(amount), method, reference, notes, allocations },
      });
      toast.success(`${isReceipt ? "Receipt" : "Payment"} recorded.`);
      setOpen(false);
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function doVoid() {
    if (!voidFor) return;
    setBusy(true);
    try {
      await api(`/api/accounting/payments/${voidFor.id}`, { method: "DELETE" });
      toast.success("Voided.");
      setVoidFor(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to void");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isReceipt ? "Receipts" : "Payments"}
        subtitle={
          isReceipt
            ? "Money received from customers, applied against open invoices. Each receipt posts Dr Bank/Cash/M-Pesa, Cr Accounts Receivable."
            : "Money paid to suppliers, applied against open bills. Each payment posts Dr Accounts Payable, Cr Bank/Cash/M-Pesa."
        }
      />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Record {isReceipt ? "receipt" : "payment"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="card p-6 text-sm text-slate-400">No {isReceipt ? "receipts" : "payments"} yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">{isReceipt ? "Customer" : "Supplier"}</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Allocated</th>
                <th className="px-4 py-3 text-right">Unapplied</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-slate-500">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.contactName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.reference ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{r.method}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtKsh(r.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtKsh(r.allocated)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700">{r.unallocated > 0 ? fmtKsh(r.unallocated) : "—"}</td>
                  <td className="px-4 py-3">
                    <button className="btn-secondary btn-xs text-red-600" onClick={() => setVoidFor(r)}>Void</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal title={`Record ${isReceipt ? "receipt" : "payment"}`} onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div>
              <label className="label">{isReceipt ? "Customer" : "Supplier"}</label>
              <select className={inputCls()} value={contactId} onChange={(e) => loadItems(e.target.value)}>
                <option value="">Select…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Date</label>
                <input type="date" className={inputCls()} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Amount</label>
                <input type="number" className={inputCls()} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Method</label>
                <select className={inputCls()} value={method} onChange={(e) => setMethod(e.target.value as never)}>
                  <option value="bank">Bank</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Reference</label>
                <input className={inputCls()} value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div>
                <label className="label">Notes</label>
                <input className={inputCls()} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            {contactId && (
              <div className="rounded-lg border border-slate-200">
                <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Apply to open {isReceipt ? "invoices" : "bills"}
                </p>
                {items.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-400">No open items.</p>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-auto p-2">
                    {items.map((it) => (
                      <div key={it.id} className="grid grid-cols-12 items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                        <span className="col-span-5">
                          <span className="font-mono text-xs text-slate-600">{it.number}</span>
                          <span className="ml-2 text-xs text-slate-400">due {it.dueDate}</span>
                        </span>
                        <span className="col-span-4 text-right text-xs text-slate-500">{fmtKsh(it.balanceDue)}</span>
                        <input
                          className={`${inputCls()} col-span-3`}
                          type="number"
                          placeholder="0"
                          value={alloc[it.id] ?? ""}
                          onChange={(e) => setAlloc((p) => ({ ...p, [it.id]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Allocated</span>
              <span className="font-semibold text-slate-700">{fmtKsh(allocTotal)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Post"}</button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={voidFor !== null}
        title={`Void ${isReceipt ? "receipt" : "payment"}`}
        message={<>Reverse the journal and unapply its allocations for <strong>{voidFor?.contactName}</strong>? The original entry is kept and a reversing entry is posted.</>}
        confirmLabel="Void"
        busy={busy}
        onConfirm={doVoid}
        onCancel={() => setVoidFor(null)}
      />
    </div>
  );
}
