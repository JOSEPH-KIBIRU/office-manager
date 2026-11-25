import type { Metadata } from "next";
import Link from "next/link";
import { SOLUTIONS } from "@/lib/solutions";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

export const metadata: Metadata = {
  title: "Office Management Solutions for Kenyan Businesses | Office Manager",
  description:
    "Explore Office Manager solutions for payroll, leave, accounting, KRA eTIMS, attendance, visitors, assets, CRM, healthcare and more — built for Kenyan SMEs.",
  alternates: { canonical: `${BASE_URL}/solutions` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/solutions`,
    siteName: "Office Manager",
    title: "Office Management Solutions for Kenyan Businesses",
    description:
      "Payroll, leave, accounting, eTIMS, attendance, CRM and healthcare — one secure workspace for Kenyan SMEs.",
    locale: "en_KE",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Office Manager solutions for Kenyan businesses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Office Management Solutions for Kenyan Businesses",
    description:
      "Payroll, leave, accounting, eTIMS, attendance, CRM and healthcare — one secure workspace for Kenyan SMEs.",
    images: [`${BASE_URL}/opengraph-image.png`],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ItemList",
      name: "Office Manager solutions",
      itemListElement: SOLUTIONS.map((solution, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: solution.title,
        url: `${BASE_URL}/solutions/${solution.slug}`,
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Solutions", item: `${BASE_URL}/solutions` },
      ],
    },
  ],
};

export default function SolutionsPage() {
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
            <Link href="/#pricing" className="hidden text-sm font-medium text-slate-600 hover:text-blue-700 sm:block">
              Pricing
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
          <p className="eyebrow-dark">Solutions</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            One workspace for every part of your office
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Start with the area that hurts most — payroll, leave, accounting, eTIMS, attendance,
            CRM, clinics or invoicing — and add the rest as your team grows.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/#contact"
              className="inline-flex items-center rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-500"
            >
              Request a demo
            </Link>
            <Link
              href="/#modules"
              className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-7 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              See all modules
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((solution) => (
            <Link
              key={solution.slug}
              href={`/solutions/${solution.slug}`}
              className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">
                {solution.icon}
              </span>
              <h2 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-blue-700">
                {solution.title}
              </h2>
              <p className="mt-1 text-sm font-medium text-blue-700">{solution.tagline}</p>
              <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">
                {solution.summary}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                {solution.features.slice(0, 2).map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-600">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-5 text-sm font-semibold text-blue-700">Explore {solution.navLabel} →</span>
            </Link>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Not sure where to start?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-600">
            Leave your phone number and we&apos;ll call you back. We&apos;ll recommend the modules
            that fit your team — no long forms, no obligation.
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
            <Link href="/#pricing" className="hover:text-blue-700">Pricing</Link>
            <Link href="/#contact" className="hover:text-blue-700">Contact</Link>
            <a href="https://pigiecore.co.ke" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 hover:text-blue-600">
              PigieCore Solutions
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
