import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/PageShell";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

const SUBPROCESSORS = [
  {
    provider: "Vercel",
    purpose: "Application hosting, CDN and edge network",
    data: "Account and usage data, request metadata, application logs",
    location: "United States",
  },
  {
    provider: "Convex",
    purpose: "Database, server functions and application storage",
    data: "Company records, user accounts and application data",
    location: "United States",
  },
  {
    provider: "UploadThing",
    purpose: "File and document storage",
    data: "Files and documents uploaded by customers",
    location: "United States",
  },
  {
    provider: "Resend",
    purpose: "Transactional email delivery",
    data: "Recipient email address, name and message content",
    location: "United States",
  },
  {
    provider: "TalkSasa",
    purpose: "SMS notifications and alerts",
    data: "Recipient phone number and message content",
    location: "Kenya",
  },
  {
    provider: "DeepSeek",
    purpose: "Optional AI drafting and analysis features",
    data: "Only the text a user submits to an AI feature",
    location: "China",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Subprocessors — Office Manager",
      url: `${BASE_URL}/subprocessors`,
      description:
        "The third-party service providers Office Manager uses to host, store and deliver the service.",
      inLanguage: "en-KE",
      isPartOf: { "@type": "WebSite", name: "Office Manager", url: `${BASE_URL}/` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Security", item: `${BASE_URL}/security` },
        {
          "@type": "ListItem",
          position: 3,
          name: "Subprocessors",
          item: `${BASE_URL}/subprocessors`,
        },
      ],
    },
  ],
};

export const metadata: Metadata = {
  title: "Subprocessors | Office Manager",
  description:
    "The third-party providers Office Manager uses for hosting, database, file storage, email, SMS and optional AI features, and what data each handles.",
  alternates: { canonical: `${BASE_URL}/subprocessors` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/subprocessors`,
    siteName: "Office Manager",
    title: "Subprocessors | Office Manager",
    description:
      "Hosting, database, file storage, email, SMS and optional AI providers — and what data each handles.",
    locale: "en_KE",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Office Manager subprocessors",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Subprocessors | Office Manager",
    description:
      "Hosting, database, file storage, email, SMS and optional AI providers — and what data each handles.",
    images: [`${BASE_URL}/opengraph-image.png`],
  },
};

export default function SubprocessorsPage() {
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
          <p className="eyebrow-dark">Trust &amp; compliance</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Subprocessors
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Office Manager uses a small set of established providers to run the service. This page
            lists each one, why we use it and the data it handles.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/security"
              className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-500"
            >
              Security overview
            </Link>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/10 px-7 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <caption className="sr-only">
              Third-party subprocessors used by Office Manager
            </caption>
            <thead className="bg-slate-100">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold text-slate-900">Provider</th>
                <th scope="col" className="px-4 py-3 font-semibold text-slate-900">Purpose</th>
                <th scope="col" className="px-4 py-3 font-semibold text-slate-900">Data handled</th>
                <th scope="col" className="px-4 py-3 font-semibold text-slate-900">Location</th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((row) => (
                <tr key={row.provider} className="border-t border-slate-200 align-top">
                  <th scope="row" className="px-4 py-4 font-semibold text-slate-900">
                    {row.provider}
                  </th>
                  <td className="px-4 py-4 text-slate-600">{row.purpose}</td>
                  <td className="px-4 py-4 text-slate-600">{row.data}</td>
                  <td className="px-4 py-4 text-slate-600">{row.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-bold text-slate-900">Changes to this list</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              We review this list when providers change. If a new subprocessor will handle personal
              data in a materially different way, we will update this page and, where required,
              notify affected customers before the change takes effect.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-bold text-slate-900">Data processing terms</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              A data processing addendum is available for customers who need one. Contact{" "}
              <a
                href="mailto:support@pigiecore.co.ke"
                className="inline-flex min-h-6 items-center font-semibold text-blue-700 hover:text-blue-600"
              >
                support@pigiecore.co.ke
              </a>{" "}
              with your company details.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-base font-bold text-slate-900">International transfers</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Some providers process data outside Kenya. Where that happens, we rely on the provider&apos;s
            contractual safeguards and security controls. If your organisation has specific residency
            or transfer requirements, tell us before onboarding so we can confirm whether the service
            fits.
          </p>
        </div>

        <p className="mt-8 text-sm text-slate-600">
          See also:{" "}
          <Link href="/security" className="inline-flex min-h-6 items-center font-semibold text-blue-700 hover:text-blue-600">
            Security &amp; trust
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="inline-flex min-h-6 items-center font-semibold text-blue-700 hover:text-blue-600">
            Privacy Policy
          </Link>{" "}
          ·{" "}
          <Link href="/status" className="inline-flex min-h-6 items-center font-semibold text-blue-700 hover:text-blue-600">
            Service status
          </Link>{" "}
          ·{" "}
          <a
            href="/.well-known/security.txt"
            className="inline-flex min-h-6 items-center font-semibold text-blue-700 hover:text-blue-600"
          >
            security.txt
          </a>
        </p>
      </section>

      <MarketingFooter />
    </main>
  );
}
