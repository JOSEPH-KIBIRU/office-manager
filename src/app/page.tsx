import Link from "next/link";
import type { Metadata } from "next";
import HeroVisual from "@/components/HeroVisual";

const BASE_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Office Manager — All-in-One Office Management Software in Kenya",
  description:
    "Office Manager is Kenya's all-in-one office management software: KRA-compliant payroll (PAYE, NSSF, SHIF, Housing Levy, HELB), employee leave management, petty cash, car logs, meetings with AI minutes, invoicing and SMS & email alerts — built for SMEs and growing businesses across Nairobi and Kenya.",
  keywords: [
    "office management software Kenya",
    "office management system Kenya",
    "HR software Kenya",
    "payroll software Kenya",
    "KRA compliant payroll Kenya",
    "employee leave management Kenya",
    "petty cash management software",
    "business management software Kenya",
    "SME software Kenya",
    "NSSF SHIF payroll software",
    "office admin software Nairobi",
  ],
  alternates: { canonical: `${BASE_URL}/` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/`,
    siteName: "Office Manager",
    title: "Office Manager — All-in-One Office Management Software in Kenya",
    description:
      "Payroll that handles PAYE, NSSF, SHIF & Housing Levy, plus leave, petty cash, car logs, meeting minutes and invoicing — all in one platform for Kenyan businesses.",
    locale: "en_KE",
    countryName: "Kenya",
  },
  twitter: {
    card: "summary_large_image",
    title: "Office Manager — All-in-One Office Management Software in Kenya",
    description:
      "KRA-compliant payroll, leave, petty cash, car logs, meeting minutes and invoicing for Kenyan businesses.",
  },
  robots: { index: true, follow: true },
  category: "business",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Office Manager",
      url: `${BASE_URL}/`,
      description:
        "All-in-one office management software for Kenyan businesses — payroll, leave, petty cash, car logs, meetings and invoicing.",
      address: { "@type": "PostalAddress", addressCountry: "KE" },
      areaServed: "Kenya",
    },
    {
      "@type": "SoftwareApplication",
      name: "Office Manager",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${BASE_URL}/`,
      description:
        "KRA-compliant payroll, employee leave management, petty cash, car logs, meetings and invoicing software for Kenyan businesses.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KES" },
      countriesSupported: "KE",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Does Office Manager handle Kenyan statutory payroll deductions?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Office Manager automatically computes PAYE, NSSF, SHIF (Social Health Insurance Fund), Affordable Housing Levy and optional HELB deductions in line with current Kenya Revenue Authority (KRA) rules, and generates digital payslips.",
          },
        },
        {
          "@type": "Question",
          name: "Can employees apply for leave through the system?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Employees apply for annual, sick, bereavement, maternity and other leave in seconds. Managers approve or reject with one tap, balances update automatically, and everyone gets notified by SMS and email.",
          },
        },
        {
          "@type": "Question",
          name: "Is Office Manager suitable for SMEs in Kenya?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Absolutely. Office Manager is built for small and medium businesses across Kenya — including SMEs in Nairobi, Mombasa, Kisumu, Nakuru and Eldoret — combining payroll, petty cash, car logs, meetings and invoicing in one affordable platform.",
          },
        },
        {
          "@type": "Question",
          name: "Does Office Manager support multi-company offices?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Each organization gets its own fully private workspace, so staff, requests and records stay completely isolated between companies.",
          },
        },
      ],
    },
  ],
};

function Icon({ d, extra }: { d: string; extra?: React.ReactNode }) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {extra}
    </svg>
  );
}

const FEATURES = [
  {
    title: "KRA-Compliant Payroll",
    body: "Automatic PAYE, NSSF, SHIF, Affordable Housing Levy and HELB deductions, with digital payslips your team can print or save as PDF.",
    icon: <Icon d="M12 2.5 3.5 6v5c0 4.6 3.6 8.7 8.5 10 4.9-1.3 8.5-5.4 8.5-10V6L12 2.5Z M9 12l2 2 4-4" />,
  },
  {
    title: "Leave Management",
    body: "Employees apply in seconds; admins approve with one tap. Balances update automatically and reset every year.",
    icon: <Icon d="M6 3v2m12-2v2M3.5 9h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5Z" />,
  },
  {
    title: "Petty Cash",
    body: "Request, approve, pay out — then generate an official petty cash requisition form ready to print, with a full approval trail.",
    icon: <Icon d="M2.5 6.5h15v11h-15v-11Zm15 3h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2m-6-4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />,
  },
  {
    title: "Car Logs",
    body: "Track repairs, insurance and servicing per vehicle, with printable requisition forms and complete approval histories.",
    icon: <Icon d="M8 16.5 6 12h12l-2 4.5M8 16.5h8m-8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6 12l1.6-4.2A2 2 0 0 1 9.5 6.5h5a2 2 0 0 1 1.9 1.3L18 12" />,
  },
  {
    title: "Meetings & AI Minutes",
    body: "Schedule meetings, invite the team and write minutes — or let AI draft professional minutes from your bullet points in seconds.",
    icon: <Icon d="M8 10h8M8 14h5m-7.5 6L7.8 17H19a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 19 5H5A1.5 1.5 0 0 0 3.5 6.5v13l2-1.5Z" />,
  },
  {
    title: "Invoicing & Bills",
    body: "Create and send professional invoices with VAT, track paid and overdue status, and manage supplier bills in one accounts hub.",
    icon: <Icon d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm-3 7h4m-4 4h4m-4-4h-2m2 8h-2" extra={<path d="M12 8V3l5 5" />} />,
  },
  {
    title: "SMS & Email Alerts",
    body: "Admins are notified the moment a request lands, and staff hear about decisions instantly — via SMS and email in-app alerts.",
    icon: <Icon d="M14.85 14.15 21 8m-9.85 9.15c.7-.7.35-2.13-.79-3.26-1.13-1.14-2.56-1.5-3.26-.79L4.3 15.9c-1.06 1.06-.35 2.99 1.41 4.74 1.75 1.76 3.68 2.47 4.74 1.41l2.55-2.55Zm4.4-13.9c1.76-1.76 3.68-2.47 4.74-1.41 1.07 1.07.36 2.99-1.4 4.75" />,
  },
  {
    title: "Multi-Company",
    body: "Every organization gets its own private workspace — staff, requests and records stay fully isolated and secure.",
    icon: <Icon d="M3 21h18M5 21V7l7-4 7 4v14M9.5 21v-4h5v4M9.5 11h.01M14.5 11h.01M9.5 14.5h.01M14.5 14.5h.01" />,
  },
];

const STATS = [
  { value: "5+", label: "Accounting modules" },
  { value: "1 tap", label: "Approvals workflow" },
  { value: "100%", label: "KRA-compliant payroll" },
  { value: "24/7", label: "Always available in the cloud" },
];

const STEPS = [
  { n: "01", title: "Set up your workspace", body: "Your admin creates the company and adds the team. Accounts arrive by email and SMS." },
  { n: "02", title: "Run daily operations", body: "Process payroll, approve leave and petty cash, log car repairs and hold meetings — all in one place." },
  { n: "03", title: "Stay compliant & informed", body: "Statutory deductions are calculated automatically and everyone is notified instantly by SMS and email." },
];

const FAQS = [
  {
    q: "Does Office Manager handle Kenyan statutory payroll deductions?",
    a: "Yes. Office Manager automatically computes PAYE, NSSF, SHIF, Affordable Housing Levy and optional HELB deductions in line with current Kenya Revenue Authority (KRA) rules, and generates digital payslips.",
  },
  {
    q: "Can employees apply for leave through the system?",
    a: "Yes. Employees apply for annual, sick, bereavement, maternity and other leave in seconds. Managers approve or reject with one tap, balances update automatically, and everyone gets notified by SMS and email.",
  },
  {
    q: "Is Office Manager suitable for SMEs in Kenya?",
    a: "Absolutely. Office Manager is built for small and medium businesses across Kenya — including SMEs in Nairobi, Mombasa, Kisumu, Nakuru and Eldoret — combining payroll, petty cash, car logs, meetings and invoicing in one affordable platform.",
  },
  {
    q: "Does Office Manager support multi-company offices?",
    a: "Yes. Each organization gets its own fully private workspace, so staff, requests and records stay completely isolated between companies.",
  },
  {
    q: "How are notifications and approvals handled?",
    a: "When an employee submits a request, the relevant manager and admin are notified instantly. Approvals and rejections are recorded with a full audit trail and the employee is informed by SMS and email.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav — two sections like Algolia */}
      <header className="sticky top-0 z-30">
        {/* Top utility / promo bar */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5 text-xs">
            <p className="font-medium">
              <span className="mr-1.5">✨</span>New: AI meeting minutes — recap faster
            </p>
            <a href="#features" className="font-semibold underline-offset-2 hover:underline">See what&apos;s new →</a>
          </div>
        </div>

        {/* Main nav */}
        <nav className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white">OM</span>
              <span className="font-semibold tracking-tight text-slate-900">Office Manager</span>
            </div>
            <div className="hidden items-center gap-7 md:flex">
              <Link href="#" className="text-sm font-medium text-slate-700 transition hover:text-blue-600">Home</Link>
              <Link href="#features" className="text-sm font-medium text-slate-700 transition hover:text-blue-600">Features</Link>
              <Link href="#faq" className="text-sm font-medium text-slate-700 transition hover:text-blue-600">FAQ</Link>
            </div>
            <Link href="/login" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero — dark, seamless, Algolia-style */}
      <section className="relative overflow-hidden bg-slate-950">
        {/* ambient glows for depth — blend into one canvas */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute right-10 top-1/3 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-20 lg:grid-cols-2 lg:gap-6">
          {/* Left: copy (minimal, white on dark) */}
          <div className="relative">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Run the whole office,{" "}
              <span className="bg-gradient-to-r from-blue-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
                without the paperwork
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Payroll, leave, petty cash, meetings &amp; invoicing — all in one platform.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="rounded-lg bg-blue-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
              >
                Sign in
              </Link>
              <a
                href="#features"
                className="rounded-lg bg-white/10 px-7 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Explore features
              </a>
            </div>
          </div>

          {/* Right: rotating hero visuals, edges dissolved into bg */}
          <HeroVisual
            slides={[
              { src: "/images/hero/team-meeting.jpg", alt: "A team collaborating around a table" },
              { src: "/images/hero/office-working.jpg", alt: "Professionals working in a bright modern office" },
              { src: "/images/hero/planning-charts.jpg", alt: "Business planning with charts and a laptop" },
              { src: "/images/hero/laptop-desk.jpg", alt: "A clean workspace with a laptop" },
              { src: "/images/hero/accounting-sheet.jpg", alt: "Accounting and finance with spreadsheets" },
            ]}
          />
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-slate-100 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-slate-900">{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Everything a busy Kenyan office needs
          </h2>
          <p className="mt-3 text-slate-500">
            From compliance to cash, one platform replaces a stack of spreadsheets, notebooks and paper forms.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card group p-6 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
                {f.icon}
              </div>
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance banner */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-3 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Kenya tax compliance built in
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Payroll that keeps you on the right side of KRA
              </h2>
              <p className="mt-4 text-slate-300">
                Stop doing payroll in Excel. Office Manager calculates the statutory deductions your
                business must withhold — PAYE, NSSF, SHIF (Social Health Insurance Fund) and the
                Affordable Housing Levy — and deducts HELB where applicable. Every employee gets a
                clean, digital payslip.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-200">
                {["PAYE on the correct tax bands", "NSSF & SHIF contributions computed automatically", "Affordable Housing Levy (1.5%) included", "Printable payslips your team can save as PDF", "One-tap duplicate checks for each pay period"].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" /></svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Sample payslip</p>
              {[
                ["Basic pay", "KSh 75,000.00"],
                ["NSSF", "KSh 4,500.00"],
                ["SHIF", "KSh 2,062.50"],
                ["Housing Levy", "KSh 1,125.00"],
                ["Taxable pay", "KSh 67,312.50"],
                ["PAYE", "KSh 12,577.08"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/5 py-2 text-sm">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-white">{v}</span>
                </div>
              ))}
              <div className="mt-3 flex justify-between text-sm font-bold text-emerald-300">
                <span>Net pay</span>
                <span>KSh 54,735.39</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Up and running in minutes</h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative border-l-2 border-blue-100 pl-6">
              <span className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{s.n}</span>
              <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">Frequently asked questions</h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="card group p-5">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {f.q}
                    <span className="text-slate-400 transition group-open:rotate-45">＋</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-800 text-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to bring order to your office?</h2>
          <p className="mt-3 text-blue-100">
            Sign in to your workspace or ask your admin to set your team up. Credentials arrive by email and SMS.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="rounded-lg bg-white px-7 py-3.5 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">
              Sign in
            </Link>
            <Link href="#features" className="rounded-lg border border-white/30 bg-white/10 px-7 py-3.5 font-semibold text-white transition hover:bg-white/20">
              See what&apos;s inside
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white">OM</span>
              <span className="font-semibold text-slate-700">Office Manager</span>
            </div>
            <p className="text-xs text-slate-400">
              Office management software trusted by growing businesses in Nairobi, Mombasa, Kisumu, Nakuru and Eldoret.
            </p>
          </div>
          <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row">
            <p>© {new Date().getFullYear()} Office Manager · Made for Kenyan businesses</p>
            <div className="flex gap-4">
              <Link href="/login" className="transition hover:text-slate-600">Sign in</Link>
              <a href="#features" className="transition hover:text-slate-600">Features</a>
              <a href="#faq" className="transition hover:text-slate-600">FAQ</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
