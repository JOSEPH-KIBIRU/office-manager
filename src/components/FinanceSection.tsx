/**
 * Finance section — where the company's money is going, with consistent status
 * badges (Pending / Approved / Paid / Rejected / Overdue). Sample data only.
 */
const BADGE: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700",
  Approved: "bg-blue-50 text-blue-700",
  Paid: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
  Overdue: "bg-red-50 text-red-700",
  Sent: "bg-sky-50 text-sky-700",
};

const ROWS: { type: string; label: string; amount: string; status: string }[] = [
  { type: "Invoice", label: "Nairobi Builders Ltd · INV-014", amount: "KES 210,000", status: "Overdue" },
  { type: "Petty cash", label: "Office supplies · Wanjiku", amount: "KES 12,000", status: "Pending" },
  { type: "Petty cash", label: "Vehicle fuel · transport", amount: "KES 18,500", status: "Paid" },
  { type: "Bill", label: "Safaricom services · SM-221", amount: "KES 42,300", status: "Approved" },
  { type: "Expense", label: "Repair purchase · duplicated", amount: "KES 6,200", status: "Rejected" },
];

const INSIGHT_OBJECTS = [
  { title: "Petty cash approved", value: "KES 84,500" },
  { title: "Invoiced this month", value: "KES 486,000" },
  { title: "Outstanding (overdue)", value: "KES 210,000" },
];

export default function FinanceSection() {
  return (
    <section id="finance" className="scroll-mt-20 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Copy + insights */}
          <div>
            <p className="eyebrow">Finance</p>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Know where company <span className="text-grad">money is going.</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Track expenses, petty cash and invoices with clear payment states, an approval trail
              and financial reports — no more chasing receipts in WhatsApp and inboxes.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {INSIGHT_OBJECTS.map((o) => (
                <div key={o.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                  <p className="text-[11px] font-medium text-slate-400">{o.title}</p>
                  <p className="mt-1 text-base font-bold text-slate-900">{o.value}</p>
                </div>
              ))}
            </div>
            <a href="#contact" className="btn-grad mt-8">
              See how approvals work
            </a>
          </div>

          {/* Transactions table with badges */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 ring-1 ring-slate-900/5">
            <p className="text-xs font-semibold text-slate-700">Recent activity</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              {ROWS.map((r, i) => (
                <div
                  key={r.label}
                  className={`flex items-center gap-3 px-3 py-2.5 ${i % 2 ? "bg-slate-50/50" : "bg-white"}`}
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-50 text-[9px] font-bold uppercase text-blue-700">
                    {r.type.slice(0, 3)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-slate-800">{r.label}</div>
                    <div className="text-[10px] text-slate-400">{r.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-semibold text-slate-800">{r.amount}</div>
                    <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${BADGE[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Sample data shown for illustration.</p>
          </div>
        </div>
      </div>
    </section>
  );
}