"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, Modal, ConfirmDialog, StatusBadge, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface CreditNote {
  id: string;
  kind: "sales_credit" | "purchase_debit";
  number: string;
  contactId: string;
  contactName: string;
  issueDate: string;
  amount: number;
  taxRate: number;
  subtotal: number;
  taxTotal: number;
  total: number;
  reason: string | null;
  status: "draft" | "issued" | "void";
}

interface Contact {
  id: string;
  name: string;
}

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

export default function CreditNotesPage() {
  const [kind, setKind] = useState<"sales_credit" | "purchase_debit">("sales_credit");
  const [rows, setRows] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [voidFor, setVoidFor] = useState<CreditNote | null>(null);

  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [taxRate, setTaxRate] = useState("16");
  const [reason, setReason] = useState("");
  const toast = useToast();

  const isSales = kind === "sales_credit";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ creditNotes: CreditNote[] }>(`/api/accounting/credit-notes?kind=${kind}`);
      setRows(d.creditNotes);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load credit notes");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    api<{ contacts: Contact[] }>(`/api/contacts?type=${isSales ? "customer" : "supplier"}`)
      .then((d) => setContacts(d.contacts))
      .catch(() => setContacts([]));
  }, [open, isSales]);

  async function save() {
    if (!contactId || !amount || Number(amount) <= 0) {
      setError("Select a contact and enter an amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/accounting/credit-notes", {
        method: "POST",
        json: { contactId, kind, issueDate, amount: Number(amount), taxRate: Number(taxRate), reason },
      });
      toast.success("Saved as draft. Use Issue to post it to the ledger.");
      setOpen(false);
      setContactId("");
      setAmount("");
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function issue(cn: CreditNote) {
    setBusy(true);
    try {
      await api(`/api/accounting/credit-notes/${cn.id}`, { method: "PATCH", json: { action: "issue" } });
      toast.success("Posted to the ledger.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to issue");
    } finally {
      setBusy(false);
    }
  }

  async function doVoid() {
    if (!voidFor) return;
    setBusy(true);
    try {
      await api(`/api/accounting/credit-notes/${voidFor.id}`, { method: "PATCH", json: { action: "void" } });
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
        title="Credit & debit notes"
        subtitle={
          isSales
            ? "Credit notes reduce what a customer owes: Dr Revenue + Dr Output VAT, Cr Accounts Receivable."
            : "Debit notes reduce what we owe a supplier: Dr Accounts Payable, Cr Expense + Cr Input VAT."
        }
      />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        {(["sales_credit", "purchase_debit"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              kind === k ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {k === "sales_credit" ? "Sales credit notes" : "Purchase debit notes"}
          </button>
        ))}
        <button className="btn-primary ml-auto" onClick={() => setOpen(true)}>
          + New {isSales ? "credit" : "debit"} note
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="card p-6 text-sm text-slate-400">No notes yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">{isSales ? "Customer" : "Supplier"}</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-right">VAT</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((cn) => (
                <tr key={cn.id}>
                  <td className="px-4 py-3 font-mono text-slate-600">{cn.number}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{cn.contactName}</td>
                  <td className="px-4 py-3 text-slate-500">{cn.issueDate}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtKsh(cn.subtotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtKsh(cn.taxTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtKsh(cn.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={cn.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {cn.status === "draft" && (
                        <button className="btn-primary btn-xs" onClick={() => issue(cn)} disabled={busy}>Issue</button>
                      )}
                      {cn.status !== "void" && (
                        <button className="btn-secondary btn-xs text-red-600" onClick={() => setVoidFor(cn)}>Void</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal title={`New ${isSales ? "credit" : "debit"} note`} onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div>
              <label className="label">{isSales ? "Customer" : "Supplier"}</label>
              <select className={inputCls()} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">Select…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Date</label>
                <input type="date" className={inputCls()} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Gross amount</label>
                <input type="number" className={inputCls()} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">VAT %</label>
                <input type="number" className={inputCls()} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Reason</label>
              <input className={inputCls()} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <p className="text-xs text-slate-400">
              Saved as a draft first — click <strong>Issue</strong> to post it through the journal engine.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={voidFor !== null}
        title="Void note"
        message={<>Post a reversing entry for <strong>{voidFor?.number}</strong> and unapply its allocations?</>}
        confirmLabel="Void"
        busy={busy}
        onConfirm={doVoid}
        onCancel={() => setVoidFor(null)}
      />
    </div>
  );
}
