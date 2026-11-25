import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/lib/guides";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

export const metadata: Metadata = {
  title: "Guides & Resources for Kenyan Offices | Office Manager",
  description:
    "Practical guides on Kenyan payroll, KRA eTIMS, Excel migration, leave policies and choosing office management software.",
  alternates: { canonical: `${BASE_URL}/resources` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/resources`,
    siteName: "Office Manager",
    title: "Guides & Resources for Kenyan Offices",
    description:
      "Practical guides on payroll, KRA eTIMS, Excel migration, leave policies and choosing office management software in Kenya.",
    locale: "en_KE",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Office Manager guides and resources",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Guides & Resources for Kenyan Offices",
    description:
      "Practical guides on payroll, eTIMS, Excel migration and office software for Kenyan SMEs.",
    images: [`${BASE_URL}/opengraph-image.png`],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ItemList",
      name: "Office Manager guides and resources",
      itemListElement: GUIDES.map((guide, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: guide.title,
        url: `${BASE_URL}/resources/${guide.slug}`,
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Resources", item: `${BASE_URL}/resources` },
      ],
    },
  ],
};

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white">
              OM
            </span>
            <span className="font-semibold tracking-tight text-slate-900">Office Manager</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/solutions" className="hidden text-sm font-medium text-slate-600 hover:text-blue-700 sm:block">
              Solutions
            </Link>
            <Link
              href="/#contact"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Request a demo
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="eyebrow-dark">Resources</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Practical guides for running a Kenyan office
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Plain-English guides on payroll, KRA eTIMS, Excel migration, leave policies and
            choosing the right office software. No fluff, no jargon.
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
              Browse solutions
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-5 md:grid-cols-2">
          {GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/resources/${guide.slug}`}
              className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{guide.category}</span>
                <span>{guide.readingTime}</span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900 group-hover:text-blue-700">
                {guide.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{guide.description}</p>
              <span className="mt-5 text-sm font-semibold text-blue-700">Read the guide →</span>
            </Link>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Want help applying this to your office?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-600">
            Leave your phone number and we&apos;ll call you back. We&apos;ll answer questions and show
            you the relevant modules — no long forms, no obligation.
          </p>
          <Link
            href="/#contact"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white transition hover:bg-blue-500"
          >
            Request a callback
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Office Manager · Made for Kenyan businesses</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-blue-700">Home</Link>
            <Link href="/solutions" className="hover:text-blue-700">Solutions</Link>
            <Link href="/#pricing" className="hover:text-blue-700">Pricing</Link>
            <a href="https://pigiecore.co.ke" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 hover:text-blue-600">
              PigieCore Solutions
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
