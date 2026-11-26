import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/PageShell";
import PricingPlans from "@/components/marketing/PricingPlans";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

const INCLUDED = [
  "Secure, isolated company workspace",
  "Role-based access and custom roles",
  "Free onboarding and setup help",
  "Excel import for patient/consultation registers",
  "SMS and email notifications",
  "Cloud backups and restore",
];

const FAQS = [
  {
    q: "How is Office Manager priced?",
    a: "Pricing is per business by team size, not per module. Starter covers up to 10 users, Professional covers 11–20 users, and Enterprise is tailored for larger teams.",
  },
  {
    q: "Is the first month really free?",
    a: "Yes. The first month is free. After that, you can continue monthly or switch to annual billing and save 5%.",
  },
  {
    q: "Can we add more staff later?",
    a: "Yes. You can add staff as the team grows; when you outgrow a user tier, we move you to the next plan. Contact us and we will confirm the change.",
  },
  {
    q: "Is onboarding included?",
    a: "Yes. Onboarding includes workspace setup, help with configuration, and guidance on importing the registers the built-in importer supports.",
  },
  {
    q: "Can you import our existing Excel records?",
    a: "The built-in importer supports patient and consultation registers with duplicate detection and a preview. For other record types, our onboarding team helps map and verify the data.",
  },
  {
    q: "Do you offer a healthcare add-on?",
    a: "Yes. Clinics and hospitals can enable patient consultations, which adds patient records, consultation fees linked to accounting, Excel import and printable patient statements. Contact us for add-on pricing.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Pricing", item: `${BASE_URL}/pricing` },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export const metadata: Metadata = {
  title: "Pricing | Office Manager for Kenyan SMEs",
  description:
    "Simple per-business pricing for Kenyan SMEs. Payroll, accounting, eTIMS, operations and healthcare add-ons. First month free; annual billing saves 5%.",
  alternates: { canonical: `${BASE_URL}/pricing` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/pricing`,
    siteName: "Office Manager",
    title: "Pricing | Office Manager for Kenyan SMEs",
    description:
      "Simple per-business pricing. Payroll, accounting, eTIMS, operations and healthcare add-ons. First month free.",
    locale: "en_KE",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Office Manager pricing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | Office Manager for Kenyan SMEs",
    description: "Simple per-business pricing. First month free. Annual billing saves 5%.",
    images: [`${BASE_URL}/opengraph-image.png`],
  },
};

export default function PricingPage() {
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
          <p className="eyebrow-dark">Pricing</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Simple pricing for Kenyan offices
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Priced per business by team size — not per module. Your first month is free, and annual
            billing saves 5%. Free onboarding is included.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/#contact"
              className="inline-flex items-center rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-500"
            >
              Request a callback
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

      <section className="mx-auto max-w-6xl px-4 py-16">
        <PricingPlans />

        <div className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-7">
            <h2 className="text-xl font-bold text-slate-900">Every plan includes</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span aria-hidden className="mt-0.5 text-emerald-600">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Healthcare add-on</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Clinics &amp; patient consultations</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Add a patient register, consultation fees linked to the accounting ledger, Excel import
              and printable patient statements. Available as an opt-in module for clinics and hospitals.
            </p>
            <Link href="/solutions/healthcare" className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:text-blue-600">
              Explore the healthcare module →
            </Link>
            <p className="mt-4 text-xs text-slate-500">Contact us for add-on pricing.</p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            Pricing questions
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {faq.q}
                    <span aria-hidden="true" className="text-slate-400 transition group-open:rotate-45">＋</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm">
            <Link href="/security" className="font-semibold text-blue-700 hover:text-blue-600">
              How we protect your data →
            </Link>
            <Link href="/resources" className="font-semibold text-blue-700 hover:text-blue-600">
              Read the buyer&apos;s guide →
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
