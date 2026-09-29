/**
 * Operations section — positioning administrative tools that keep day-to-day
 * workflows organized. Only existing modules are shown as shipping features.
 */
const MODULES = [
  {
    title: "Meetings",
    desc: "Schedule meetings, invite the team and assign action items that actually get tracked.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: "Minutes",
    desc: "Write minutes from bullet points — or let AI draft professional minutes for you in seconds.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    title: "Vehicle management",
    desc: "Track repairs, servicing and insurance per vehicle with printable requisition forms.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h3.75L9 6.75h6l1.875 7.5h3.75m-18 0V7.125c0-.621.504-1.125 1.125-1.125h11.25c.621 0 1.125.504 1.125 1.125v7.125" />
      </svg>
    ),
  },
  {
    title: "Approvals & requisitions",
    desc: "Petty cash, car logs and other requests flow through a one-tap approval process with an audit trail.",
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

const PLANNED = [
  { label: "Tasks" },
  { label: "Office assets" },
];

export default function OperationsSection() {
  return (
    <section id="operations" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Office operations</p>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            The small things, <span className="text-grad">kept organized.</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            The small administrative tasks that normally get lost in WhatsApp messages, notebooks
            and spreadsheets now stay inside one system.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <div key={m.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm ring-1 ring-slate-900/5 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-lg">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20">
                {m.icon}
              </span>
              <h3 className="font-semibold text-slate-900">{m.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{m.desc}</p>
            </div>
          ))}
        </div>

        {PLANNED.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="font-medium">Also on the roadmap:</span>
            {PLANNED.map((p) => (
              <span key={p.label} className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-400">
                {p.label} <span className="ml-1 text-[10px] text-slate-400">(planned)</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}