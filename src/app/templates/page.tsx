import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/PageShell";
import TemplateRequestForm from "@/components/templates/TemplateRequestForm";
import { TEMPLATES } from "@/lib/templates";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

const STEPS = [
  {
    title: "Request a callback",
    body: "Leave a phone number. We only need that — no long form and no email address.",
  },
  {
    title: "A short walkthrough",
    body: "We look at how your office currently records payroll, leave, assets, invoices or patients.",
  },
  {
    title: "We send the pack",
    body: "You receive the Excel workbooks with columns that match your workflow, plus help planning an import.",
  },
];

const FAQS = [
  {
    q: "Can I download the templates directly?",
    a: "No. We share the starter pack after a short walkthrough so we can match the columns to how your office works. Request a callback and we will send it to you.",
  },
  {
    q: "What is in the starter pack?",
    a: "Payroll register, leave tracker, asset register, invoice and VAT register, and a patient register. Each workbook includes a sample row and an instructions sheet.",
  },
  {
    q: "What format are the files in?",
    a: "Standard .xlsx workbooks that open in Excel, Google Sheets and LibreOffice Calc. There are no macros.",
  },
  {
    q: "Do the templates calculate Kenyan tax?",
    a: "No. The payroll workbook has columns for PAYE, NSSF, SHIF, Housing Levy and HELB, but it does not calculate them. Confirm current rates and thresholds with KRA or your accountant. Office Manager calculates statutory payroll automatically.",
  },
  {
    q: "Can Office Manager import our existing records?",
    a: "Yes for patient and consultation registers: the importer accepts Excel or CSV with a preview and duplicate detection. For payroll, assets and invoices, our onboarding team helps map your existing columns.",
  },
  {
    q: "Does the pack cost anything?",
    a: "No. The pack and the walkthrough are free, with no obligation to subscribe.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      name: "Excel starter pack for Kenyan offices",
      url: `${BASE_URL}/templates`,
      description:
        "Payroll, leave, asset, invoice and patient register workbooks, shared after a short walkthrough.",
      inLanguage: "en-KE",
      isPartOf: { "@type": "WebSite", name: "Office Manager", url: `${BASE_URL}/` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Excel starter pack", item: `${BASE_URL}/templates` },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ],
};

export const metadata: Metadata = {
  title: "Excel Starter Pack for Kenyan Offices | Office Manager",
  description:
    "Request Office Manager's Excel starter pack for payroll, leave, assets, invoices and patient registers. We share it after a short walkthrough.",
  alternates: { canonical: `${BASE_URL}/templates` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/templates`,
    siteName: "Office Manager",
    title: "Excel Starter Pack for Kenyan Offices",
    description:
      "Payroll, leave, asset, invoice and patient register workbooks, shared after a short walkthrough.",
    locale: "en_KE",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Office Manager Excel starter pack",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Excel Starter Pack for Kenyan Offices",
    description:
      "Payroll, leave, asset, invoice and patient register workbooks, shared after a short walkthrough.",
    images: [`${BASE_URL}/opengraph-image.png`],
  },
};

export default function TemplatesPage() {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <MarketingHeader />

      <section className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="eyebrow-dark">Excel starter pack</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Practical spreadsheets, matched to your workflow
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Payroll, leave, assets, invoices and patient registers in one workbook pack. We share it
            after a short walkthrough so the columns fit how your office actually works.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="#request"
              className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-500"
            >
              Request the pack
            </Link>
            <Link
              href="/solutions"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/10 px-7 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Explore the software
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-bold text-slate-900">Why not a public download?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            A generic workbook usually needs rework before it is useful. We send the pack after a
            short conversation so the fields, dates and totals match your process, and so we can
            explain how the same records move into Office Manager when you are ready.
          </p>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">What&apos;s in the pack</h2>
          <p className="mt-2 text-sm text-slate-600">
            Five workbooks, each with a sample row and an instructions sheet.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map((template) => (
              <li
                key={template.slug}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-900">{template.name}</h3>
                  <span className="text-xs font-medium text-blue-700">{template.category}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{template.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            How it works
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="request" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Request the starter pack
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-600">
              <p>
                Tell us which workbook is most useful and we will call you back. The pack is free and
                there is no obligation to subscribe.
              </p>
              <p>
                If you already have records in Excel, bring them to the call. We can point out missing
                fields and suggest a safe way to test an import before moving everything.
              </p>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Prefer to read first?</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    href="/resources/patient-register-excel-template"
                    className="font-semibold text-blue-700 hover:text-blue-600"
                  >
                    How to build a patient register in Excel →
                  </Link>
                </li>
                <li>
                  <Link
                    href="/resources/spreadsheets-vs-office-software"
                    className="font-semibold text-blue-700 hover:text-blue-600"
                  >
                    Spreadsheets vs office management software →
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="font-semibold text-blue-700 hover:text-blue-600"
                  >
                    Plans and pricing →
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Request a callback</h2>
            <p className="mt-1 text-sm text-slate-600">
              We only ask for a phone number. No long form.
            </p>
            <div className="mt-5">
              <TemplateRequestForm />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            Starter pack questions
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {faq.q}
                    <span aria-hidden="true" className="text-slate-400 transition group-open:rotate-45">
                      ＋
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
