"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { Alert, api } from "@/components/ui";
import { OrgHeader, OrgFooter, type OrgBrandingData } from "@/components/OrgBranding";
import ShareButton from "@/components/ShareButton";

interface BillRow {
  id: string;
  contact_name: string;
  contact_company: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  number: string;
  bill_date: string;
  due_date: string;
  amount: number;
  description: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
}

const fmtMoney = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BillPrint({ id }: { id: string }) {
  const [bill, setBill] = useState<BillRow | null>(null);
  const [org, setOrg] = useState<OrgBrandingData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const printed = useRef(false);

  useEffect(() => {
    api<{ bill: BillRow }>(`/api/bills/${id}`)
      .then((d) => {
        setBill(d.bill);
        // Print once the bill has actually rendered (avoids a blank page).
        if (!printed.current) {
          printed.current = true;
          setTimeout(() => window.print(), 400);
        }
      })
      .catch((e) => setErr(e.message));
    api<OrgBrandingData>("/api/organization")
      .then(setOrg)
      .catch(() => {});
  }, [id]);

  return (
    <div className="payslip-print mx-auto max-w-3xl p-6 text-slate-900">
      {err && <Alert kind="error">{err}</Alert>}
      {!bill && !err && <p className="text-sm text-slate-500">Loading bill… (printing will open momentarily)</p>}
      {bill && (
        <>
          <OrgHeader org={org} rightLabel="BILL / INVOICE" rightSub={bill.number} />

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Bill from</p>
              <p className="font-semibold">{bill.contact_company || bill.contact_name}</p>
              <p>{bill.contact_name}</p>
              {bill.contact_email && <p>{bill.contact_email}</p>}
              {bill.contact_phone && <p>{bill.contact_phone}</p>}
            </div>
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Bill date</span><span className="font-medium">{bill.bill_date}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-slate-500">Due date</span><span className="font-medium">{bill.due_date}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-slate-500">Status</span><span className="font-semibold capitalize">{bill.status}</span></div>
              {bill.paid_at && (
                <div className="mt-1 flex justify-between"><span className="text-slate-500">Paid</span><span className="font-medium">{bill.paid_at}</span></div>
              )}
            </div>
          </div>

          <table className="mb-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left">
                <th className="py-2 pr-2">Description</th>
                <th className="py-2 pl-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-2 pr-2">{bill.description ?? "—"}</td>
                <td className="py-2 pl-2 text-right font-medium">{fmtMoney(bill.amount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mb-6 ml-auto w-64 text-sm">
            <div className="flex justify-between border-t-2 border-slate-900 py-2 text-base font-bold"><span>Total (KES)</span><span>{fmtMoney(bill.amount)}</span></div>
          </div>

          <OrgFooter org={org} text="Please settle this bill by the due date." />
        </>
      )}
    </div>
  );
}

function Inner({ id }: { id: string }) {
  return <BillPrint id={id} />;
}

export default function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve(params).then((p) => setId(p.id));
  }, [params]);
  if (!id) return null;
  return (
    <Suspense fallback={null}>
      <div className="fixed right-4 top-4 z-50 flex gap-2 no-print">
        <button onClick={() => window.print()} className="btn-primary px-3 py-1.5 text-sm">🖨 Download PDF</button>
        <ShareButton label="Share" className="btn-secondary px-3 py-1.5 text-sm" />
      </div>
      <Inner id={id} />
    </Suspense>
  );
}