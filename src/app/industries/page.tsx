import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/PageShell";
import { INDUSTRIES } from "@/lib/industries";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      name: "Office management software by industry",
      url: `${BASE_URL}/industries`,
      description:
        "How Kenyan retail shops, logistics operators, clinics, NGOs and professional firms use Office Manager.",
      inLanguage: "en-KE",
      isPartOf: { "@type": "WebSite", name: "Office Manager", url: `${BASE_URL}/` },
    },
    {
      "@type": "ItemList",
      name: "Industries",
      itemListElement: INDUSTRIES.map((industry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: industry.name,
        url: `${BASE_URL}/industries/${industry.slug}`,
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Industries", item: `${BASE_URL}/industries` },
      ],
    },
  ],
};

export const metadata: Metadata = {
  title: "Office Management Software by Industry | Office Manager",
  description:
    "See how Kenyan retail shops, logistics operators, clinics, NGOs and professional firms use Office Manager for payroll, accounting, operations and compliance.",
  alternates: { canonical: `${BASE_URL}/industries` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/industries`,
    siteName: "Office Manager",
    title: "Office Management Software by Industry",
    description:
      "Practical workflows for retail, logistics, clinics, NGOs and professional services in Kenya.",
    locale: "en_KE",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Office Manager by industry",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Office Management Software by Industry",
    description:
      "Practical workflows for retail, logistics, clinics, NGOs and professional services in Kenya.",
    images: [`${BASE_URL}/opengraph-image.png`],
  },
};

export default function IndustriesPage() {
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
          <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="eyebrow-dark">By industry</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            One workspace, shaped around your work
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            The same core platform, applied to the records and workflows each sector actually runs on
            — from vehicle logs and patient visits to donor-funded programme spending.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/#contact"
              className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-500"
            >
              Request a callback
            </Link>
            <Link
              href="/solutions"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/10 px-7 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Browse the modules
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-5 md:grid-cols-2">
          {INDUSTRIES.map((industry) => (
            <article
              key={industry.slug}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <span aria-hidden="true" className="text-3xl">
                {industry.icon}
              </span>
              <h2 className="mt-3 text-xl font-bold text-slate-900">
                <Link href={`/industries/${industry.slug}`} className="hover:text-blue-700">
                  {industry.name}
                </Link>
              </h2>
              <p className="mt-1 text-sm font-semibold text-blue-700">{industry.tagline}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                {industry.description}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                {industry.painPoints.slice(0, 2).map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-0.5 text-slate-400">–</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/industries/${industry.slug}`}
                className="mt-5 inline-flex min-h-11 items-center font-semibold text-blue-700 hover:text-blue-600"
              >
                See the {industry.navLabel.toLowerCase()} workflow →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Not sure which modules you need?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Tell us how your office runs today. We&apos;ll recommend a starting point and a safe way to
            import the records you already have.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/#contact"
              className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Request a callback
            </Link>
            <Link
              href="/resources"
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Read the guides
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
