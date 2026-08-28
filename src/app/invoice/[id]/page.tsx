"use client";

import { useEffect, useState, Suspense } from "react";
import { Alert, api } from "@/components/ui";

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  amount?: number;
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
  status: string;
  line_items: LineItem[];
  note: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  recurring_frequency: string | null;
  created_at: string;
}

const fmtMoney = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function InvoicePrint({ id }: { id: string }) {
  const [inv, setInv] = useState<InvoiceRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ invoice: InvoiceRow }>(`/api/invoices/${id}`)
      .then((d) => setInv(d.invoice))
      .catch((e) => setErr(e.message));
  }, [id]);

  return (
    <div className="payslip-print mx-auto max-w-3xl p-6 text-slate-900">
      {err && <Alert kind="error">{err}</Alert>}
      {!inv && !err && <p className="text-sm text-slate-500">Loading invoice… (printing will open momentarily)</p>}
      {inv && (
        <>
          <div className="mb-6 flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Office Manager</h1>
              <p className="text-xs text-slate-500">Business Invoicing</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-bold">INVOICE</p>
              <p className="font-mono text-sm text-indigo-700">{inv.number}</p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Bill to</p>
              <p className="font-semibold">{inv.contact_company || inv.contact_name}</p>
              <p>{inv.contact_name}</p>
              {inv.contact_address && <p>{inv.contact_address}</p>}
              {inv.contact_email && <p>{inv.contact_email}</p>}
              {inv.contact_phone && <p>{inv.contact_phone}</p>}
              {inv.contact_tin && <p className="text-xs text-slate-500">TIN: {inv.contact_tin}</p>}
            </div>
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Issue date</span><span className="font-medium">{inv.issue_date}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-slate-500">Due date</span><span className="font-medium">{inv.due_date}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-slate-500">Status</span><span className="font-semibold capitalize">{inv.status}</span></div>
              {inv.recurring_frequency && (
                <div className="mt-1 flex justify-between"><span className="text-slate-500">Recurring</span><span className="font-medium capitalize">{inv.recurring_frequency}</span></div>
              )}
            </div>
          </div>

          <table className="mb-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left">
                <th className="py-2 pr-2">Description</th>
                <th className="py-2 pr-2 text-right">Qty</th>
                <th className="py-2 pr-2 text-right">Unit price</th>
                <th className="py-2 pl-2 text-right">Tax</th>
                <th className="py-2 pl-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.line_items.map((it, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="py-2 pr-2">{it.description}</td>
                  <td className="py-2 pr-2 text-right">{it.qty}</td>
                  <td className="py-2 pr-2 text-right">{fmtMoney(it.unitPrice)}</td>
                  <td className="py-2 pr-2 text-right">{it.taxRate > 0 ? `${it.taxRate}%` : "—"}</td>
                  <td className="py-2 pl-2 text-right font-medium">{fmtMoney(it.qty * it.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mb-6 ml-auto w-64 text-sm">
            <div className="flex justify-between py-1"><span className="text-slate-500">Subtotal</span><span>{fmtMoney(inv.subtotal)}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate-500">Tax</span><span>{fmtMoney(inv.tax_total)}</span></div>
            <div className="flex justify-between border-t-2 border-slate-900 py-2 text-base font-bold"><span>Total (KES)</span><span>{fmtMoney(inv.total)}</span></div>
          </div>

          {inv.note && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <span className="font-semibold">Note: </span>{inv.note}
            </div>
          )}

          <p className="mt-8 text-center text-xs text-slate-400">
            Thank you for your business. This is an official invoice from Office Manager. Generated {new Date().toLocaleDateString("en-KE")}.
          </p>
        </>
      )}
    </div>
  );
}

function Inner({ id }: { id: string }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return <InvoicePrint id={id} />;
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve(params).then((p) => setId(p.id));
  }, [params]);
  if (!id) return null;
  return (
    <Suspense fallback={null}>
      <Inner id={id} />
    </Suspense>
  );
}
