import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/PageShell";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

const PRINCIPLES = [
  {
    title: "Built for Kenyan rules",
    body: "PAYE, NSSF, SHIF, the Affordable Housing Levy, HELB and KRA eTIMS are first-class parts of the product, not bolt-ons.",
  },
  {
    title: "One source of truth",
    body: "People, payroll, money and operations belong in one workspace. Modules post to the same ledger instead of creating another spreadsheet.",
  },
  {
    title: "Private by design",
    body: "Each company is an isolated workspace with role-based access and an audit trail. One company's data never bleeds into another.",
  },
  {
    title: "Practical onboarding",
    body: "We help configure the workspace, import the registers the product supports, and verify totals before go-live.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      name: "About Office Manager",
      url: `${BASE_URL}/about`,
      description:
        "Office Manager is all-in-one office management software for Kenyan SMEs, built by PigieCore Solutions.",
      inLanguage: "en-KE",
      isPartOf: { "@type": "WebSite", name: "Office Manager", url: `${BASE_URL}/` },
    },
    {
      "@type": "Organization",
      name: "Office Manager",
      url: `${BASE_URL}/`,
      logo: `${BASE_URL}/icon-512.png`,
      description:
        "All-in-one office management software for Kenyan SMEs — payroll, leave, accounting, eTIMS, operations and healthcare add-ons.",
      address: { "@type": "PostalAddress", addressCountry: "KE" },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+254798118515",
        contactType: "sales",
        areaServed: "KE",
        availableLanguage: ["en"],
      },
      parentOrganization: { "@type": "Organization", name: "PigieCore Solutions", url: "https://pigiecore.co.ke" },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "About", item: `${BASE_URL}/about` },
      ],
    },
  ],
};

export const metadata: Metadata = {
  title: "About Office Manager | Built for Kenyan SMEs",
  description:
    "Office Manager is all-in-one office management software for Kenyan SMEs, built by PigieCore Solutions — payroll, accounting, eTIMS, operations and healthcare.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/about`,
    siteName: "Office Manager",
    title: "About Office Manager | Built for Kenyan SMEs",
    description:
      "All-in-one office management software for Kenyan SMEs, built by PigieCore Solutions.",
    locale: "en_KE",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "About Office Manager",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Office Manager | Built for Kenyan SMEs",
    description: "All-in-one office management software for Kenyan SMEs.",
    images: [`${BASE_URL}/opengraph-image.png`],
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <MarketingHeader />

      <section className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="eyebrow-dark">About</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Less paperwork. More running the business.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Office Manager is built by PigieCore Solutions for Kenyan SMEs that want one secure place
            to run people, money and everyday operations — without stitching together spreadsheets,
            paper files and chat threads.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/#contact"
              className="inline-flex items-center rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-500"
            >
              Request a demo
            </Link>
            <Link
              href="/solutions"
              className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-7 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Explore solutions
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Why we built it</h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-600">
              <p>
                Small teams in Kenya often run payroll, leave, invoices, expenses and approvals on a
                mix of spreadsheets, paper and WhatsApp. The work gets done, but it is hard to audit,
                easy to duplicate and painful at month end.
              </p>
              <p>
                Office Manager brings those workflows into one workspace. Statutory payroll is
                calculated from a central configuration, invoices post to a real double-entry ledger,
                documents and assets have an owner and a history, and managers approve requests in one
                place.
              </p>
              <p>
                We also build for the details that matter locally: KRA eTIMS invoices, M-Pesa and bank
                reconciliation, working-day leave deduction, and the option to add patient
                consultations for clinics and hospitals.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-lg font-bold text-slate-900">At a glance</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li><strong className="text-slate-900">Product:</strong> all-in-one office management web app</li>
              <li><strong className="text-slate-900">Market:</strong> SMEs across Kenya</li>
              <li><strong className="text-slate-900">Built by:</strong> PigieCore Solutions</li>
              <li><strong className="text-slate-900">Coverage:</strong> payroll, leave, attendance, documents, assets, visitors, petty cash, fleet, meetings, eTIMS, accounting, CRM, tasks and healthcare add-ons</li>
              <li><strong className="text-slate-900">Access:</strong> any modern desktop, tablet or mobile browser</li>
            </ul>
            <div className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-600">
              <p>Talk to us:</p>
              <p className="mt-1"><a href="tel:+254798118515" className="font-semibold text-blue-700 hover:text-blue-600">0798 118 515</a></p>
              <p><a href="mailto:support@pigiecore.co.ke" className="font-semibold text-blue-700 hover:text-blue-600">support@pigiecore.co.ke</a></p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            What we optimise for
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-base font-bold text-slate-900">{principle.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{principle.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Want to see how it fits your office?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-700">
            Leave your phone number and we&apos;ll call you back. No long forms, no obligation.
          </p>
          <Link
            href="/#contact"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white transition hover:bg-blue-500"
          >
            Request a callback
          </Link>
          <p className="mt-4 text-sm text-slate-600">
            Prefer to read first?{" "}
            <Link href="/security" className="font-semibold text-blue-700 hover:text-blue-600">Security</Link>
            {" · "}
            <Link href="/pricing" className="font-semibold text-blue-700 hover:text-blue-600">Pricing</Link>
            {" · "}
            <Link href="/resources" className="font-semibold text-blue-700 hover:text-blue-600">Guides</Link>
          </p>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
