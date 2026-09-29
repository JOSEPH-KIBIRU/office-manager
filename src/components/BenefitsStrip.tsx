/**
 * Trust / benefits strip rendered immediately beneath the hero.
 */
const BENEFITS = [
  {
    title: "One Workspace",
    body: "HR, finance and administration in one platform.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 21V10.5L12 4l8 6.5V21M9 21v-4h6v4" />
      </svg>
    ),
  },
  {
    title: "Less Paperwork",
    body: "Replace repetitive spreadsheets and manual records.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12.5c-1.5 0-2.25-1-3.75-1s-2.25 1-3.75 1-2.25-1-3.75-1-2.25 1-3.75 1c-.4 0-.75-.1-1.05-.3M4 6.75A2.75 2.75 0 0 1 6.75 4h10.5A2.75 2.75 0 0 1 20 6.75v10.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25V6.75Z" />
      </svg>
    ),
  },
  {
    title: "Better Control",
    body: "Approvals, records and reports stay organized.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h6M10.5 12h6M10.5 18h6M5 6.5l1 1 2-2M5 12.5l1 1 2-2M5 18.5l1 1 2-2" />
      </svg>
    ),
  },
  {
    title: "Built for Kenya",
    body: "Kenya-ready payroll and business workflows.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5 3.5 6v5c0 4.6 3.6 8.7 8.5 10 4.9-1.3 8.5-5.4 8.5-10V6L12 2.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12l2 2 4.5-4.5" />
      </svg>
    ),
  },
];

export default function BenefitsStrip() {
  return (
    <section className="border-b border-slate-100 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {BENEFITS.map((b) => (
          <div
            key={b.title}
            className="card-hover group rounded-3xl border border-slate-200/80 bg-white p-5"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition group-hover:scale-105">
              {b.icon}
            </span>
            <h3 className="mt-4 font-semibold text-slate-900">{b.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{b.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}