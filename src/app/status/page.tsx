import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/PageShell";
import StatusPanel from "@/components/status/StatusPanel";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Service status — Office Manager",
      url: `${BASE_URL}/status`,
      description:
        "Live status of the Office Manager web application, database and dependent services.",
      inLanguage: "en-KE",
      isPartOf: { "@type": "WebSite", name: "Office Manager", url: `${BASE_URL}/` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Status", item: `${BASE_URL}/status` },
      ],
    },
  ],
};

export const metadata: Metadata = {
  title: "Service Status | Office Manager",
  description:
    "Check the live status of the Office Manager web application, database and dependent services.",
  alternates: { canonical: `${BASE_URL}/status` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/status`,
    siteName: "Office Manager",
    title: "Service Status | Office Manager",
    description:
      "Live status of the Office Manager web application, database and dependent services.",
    locale: "en_KE",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Office Manager service status",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Service Status | Office Manager",
    description:
      "Live status of the Office Manager web application, database and dependent services.",
    images: [`${BASE_URL}/opengraph-image.png`],
  },
};

export default function StatusPage() {
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
          <p className="eyebrow-dark">Service status</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Is Office Manager up?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            A live check of the application and its database. No account needed.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <StatusPanel />

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-bold text-slate-900">Something looks wrong?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              If this page says a service is unavailable, try again in a few minutes. If it persists,
              email{" "}
              <a
                href="mailto:support@pigiecore.co.ke"
                className="inline-flex min-h-6 items-center font-semibold text-blue-700 hover:text-blue-600"
              >
                support@pigiecore.co.ke
              </a>{" "}
              with the time and what you were doing.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-bold text-slate-900">How this is checked</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              The page calls a public health endpoint that queries the database. A result is only
              shown after the check completes. See the{" "}
              <Link href="/security" className="font-semibold text-blue-700 hover:text-blue-600">
                security page
              </Link>{" "}
              for how data and access are protected.
            </p>
          </div>
        </div>

        <p className="mt-8 text-sm text-slate-600">
          Related:{" "}
          <Link href="/security" className="inline-flex min-h-6 items-center font-semibold text-blue-700 hover:text-blue-600">
            Security &amp; trust
          </Link>{" "}
          ·{" "}
          <a
            href="mailto:support@pigiecore.co.ke"
            className="inline-flex min-h-6 items-center font-semibold text-blue-700 hover:text-blue-600"
          >
            Contact support
          </a>
        </p>
      </section>

      <MarketingFooter />
    </main>
  );
}
