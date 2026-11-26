import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/PageShell";
import TemplateRequestForm from "@/components/templates/TemplateRequestForm";
import { TEMPLATES } from "@/lib/templates";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

const STEPS = [
  {
    title: "Download the workbook",
    body: "Each file opens in Excel, Google Sheets or LibreOffice. No macros, no sign-up and no email required.",
  },
  {
    title: "Replace the sample row",
    body: "Keep the header row exactly as it is, then replace the example record with your own data.",
  },
  {
    title: "Import or keep using it",
    body: "The patient register matches the Office Manager importer. Other templates can be shared with your accountant or team as-is.",
  },
];

const FAQS = [
  {
    q: "Are the templates really free?",
    a: "Yes. Download them directly from this page. You do not need to give an email address or phone number.",
  },
  {
    q: "Which file format are they in?",
    a: "They are standard .xlsx workbooks and open in Excel, Google Sheets, LibreOffice Calc and most other spreadsheet apps.",
  },
  {
    q: "Can I edit the columns?",
    a: "Yes. The layouts are a practical starting point. If you plan to import into Office Manager, keep the headers in the same order so the importer can map them cleanly.",
  },
  {
    q: "Do the templates calculate Kenyan tax?",
    a: "No. The payroll template has columns for PAYE, NSSF, SHIF, Housing Levy and HELB, but it does not calculate them. Confirm current rates and thresholds with KRA or your accountant. Office Manager calculates statutory payroll automatically.",
  },
  {
    q: "Can Office Manager import these files?",
    a: "The patient register is designed to match the built-in patient and consultation importer. Payroll, assets and invoices are entered in their modules; our onboarding team can help map existing spreadsheets.",
  },
  {
    q: "Can you help us move our data?",
    a: "Yes. Leave your phone number in the form and we will call you back. We can review the file, check the required fields and help you plan a small test import before moving everything.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      name: "Free Excel templates for Kenyan offices",
      url: `${BASE_URL}/templates`,
      description:
        "Free downloadable Excel templates for payroll, leave, assets, invoices and patient registers.",
      inLanguage: "en-KE",
      isPartOf: { "@type": "WebSite", name: "Office Manager", url: `${BASE_URL}/` },
    },
    {
      "@type": "ItemList",
      name: "Free Excel templates",
      itemListElement: TEMPLATES.map((template, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${template.name} template`,
        url: `${BASE_URL}${template.file}`,
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Free templates", item: `${BASE_URL}/templates` },
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
  title: "Free Excel Templates for Kenyan Offices | Office Manager",
  description:
    "Download free Excel templates for payroll registers, leave tracking, asset registers, invoice and VAT records, and patient registers. No sign-up required.",
  alternates: { canonical: `${BASE_URL}/templates` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/templates`,
    siteName: "Office Manager",
    title: "Free Excel Templates for Kenyan Offices",
    description:
      "Payroll, leave, asset, invoice and patient register templates. Free to download, no sign-up required.",
    locale: "en_KE",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Free Excel templates for Kenyan offices",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Excel Templates for Kenyan Offices",
    description:
      "Payroll, leave, asset, invoice and patient register templates. Free to download.",
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
          <p className="eyebrow-dark">Free templates</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Practical Excel templates for Kenyan offices
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Payroll, leave, assets, invoices and patient registers — ready to use. Download any file
            directly. No email, no sign-up and no sales call required.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#downloads"
              className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-500"
            >
              Browse the templates
            </a>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/10 px-7 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              See the software
            </Link>
          </div>
        </div>
      </section>

      <section id="downloads" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Download a template</h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">
            Each workbook includes a sample row and a separate instructions sheet. Keep the header
            row intact so the file remains easy to import or share.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((template) => (
            <article
              key={template.slug}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                {template.category}
              </p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">{template.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{template.description}</p>

              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                {template.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-0.5 text-emerald-600">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Best for: {template.bestFor}
              </p>

              <a
                href={template.file}
                download
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Download .xlsx
              </a>
              <Link
                href={template.relatedSolution.href}
                className="mt-3 inline-flex min-h-6 items-center text-sm font-semibold text-blue-700 hover:text-blue-600"
              >
                {template.relatedSolution.label} →
              </Link>
            </article>
          ))}

          <aside className="flex h-full flex-col rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Ready to stop updating the spreadsheet?
            </p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              Import the register into Office Manager
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-700">
              The patient register matches our built-in importer, including duplicate detection and a
              preview before anything is saved. For other records, we help map your columns during
              onboarding.
            </p>
            <Link
              href="/#contact"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Request a callback
            </Link>
            <Link
              href="/resources/spreadsheets-vs-office-software"
              className="mt-3 inline-flex min-h-6 items-center text-sm font-semibold text-blue-700 hover:text-blue-600"
            >
              Spreadsheets vs software →
            </Link>
          </aside>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            How to use them
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

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Want help with your own file?
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-600">
              <p>
                Most teams do not need a new template — they need their existing one cleaned up so the
                required fields are present and the totals reconcile.
              </p>
              <p>
                Leave a phone number and we will call you back. We can review the structure, point out
                missing fields and suggest a safe way to test an import before moving everything.
              </p>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Related reading</h3>
              <ul className="mt-3 space-y-2 text-sm">
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
                    href="/solutions/healthcare"
                    className="font-semibold text-blue-700 hover:text-blue-600"
                  >
                    Healthcare add-on for clinics →
                  </Link>
                </li>
                <li>
                  <Link
                    href="/resources/patient-register-excel-template"
                    className="font-semibold text-blue-700 hover:text-blue-600"
                  >
                    How to build a patient register →
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
            Template questions
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
