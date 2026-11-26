import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/PageShell";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

const FAQS = [
  {
    q: "Is our company data shared with other companies?",
    a: "No. Each company is a separate workspace. Records, users and financial data are scoped to the company, and the data layer rejects cross-company access.",
  },
  {
    q: "Can we control what each staff member sees?",
    a: "Yes. Access is role-based, with module-level permissions and custom roles. The Director (admin) account has full access; other roles can be restricted.",
  },
  {
    q: "Do you support two-factor authentication?",
    a: "Yes. Accounts can use a 6-digit authenticator app code at login, with single-use recovery codes for account recovery.",
  },
  {
    q: "What happens when a staff member leaves?",
    a: "Their account can be deactivated, which stops access and invalidates existing sessions. Their records remain in the workspace for reporting and audit purposes.",
  },
  {
    q: "Are backups available?",
    a: "The platform supports per-company snapshots and restore. Contact support if you need a backup or restoration; you can also request an export of your data.",
  },
  {
    q: "Where is the data hosted?",
    a: "The application runs on Vercel, with the database, functions and file storage on Convex cloud. Data is transmitted over HTTPS.",
  },
  {
    q: "How do we report a security issue?",
    a: "Email support@pigiecore.co.ke with the details. Please do not test against live customer data; we will respond and coordinate a fix.",
  },
];

const CONTROLS = [
  {
    title: "Workspace isolation",
    body: "Every record belongs to one company. API routes bind the signed-in user to their workspace, and the data layer verifies membership before reading or writing.",
  },
  {
    title: "Role-based access",
    body: "Built-in roles — Director, Admin/Secretary, Manager and Employee — plus custom roles and per-module grants. Sensitive actions can be limited to specific roles.",
  },
  {
    title: "Authentication",
    body: "Passwords are hashed with bcrypt. Sessions use signed, httpOnly cookies, and role or password changes invalidate existing sessions.",
  },
  {
    title: "Two-factor authentication",
    body: "Optional authenticator-app codes at login, with single-use recovery codes. 2FA secrets are protected and can be reset by an administrator.",
  },
  {
    title: "Audit trail",
    body: "Significant actions — logins, approvals, permission changes and administrative actions — are recorded so you can review who changed what and when.",
  },
  {
    title: "Platform protections",
    body: "HTTPS with HSTS, a Content-Security-Policy, a same-origin guard for state-changing requests, rate limiting and secure file handling.",
  },
  {
    title: "Backups & recovery",
    body: "Per-company snapshots and restore are supported for recovery and migrations. You can request an export of your company data.",
  },
  {
    title: "Upload controls",
    body: "Uploads are bounded, validated by type and size, and can be passed through an optional external antivirus scanner before being stored.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Security & trust — Office Manager",
      url: `${BASE_URL}/security`,
      description:
        "How Office Manager protects company data: workspace isolation, role-based access, authentication, 2FA, audit trails and backups.",
      inLanguage: "en-KE",
      isPartOf: { "@type": "WebSite", name: "Office Manager", url: `${BASE_URL}/` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Security", item: `${BASE_URL}/security` },
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
  title: "Security & Trust | Office Manager",
  description:
    "How Office Manager protects company data: isolated workspaces, role-based access, secure authentication, 2FA, audit trails and backups.",
  alternates: { canonical: `${BASE_URL}/security` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/security`,
    siteName: "Office Manager",
    title: "Security & Trust | Office Manager",
    description:
      "Isolated workspaces, role-based access, secure authentication, 2FA, audit trails and backups.",
    locale: "en_KE",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Office Manager security and trust",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Security & Trust | Office Manager",
    description: "Isolated workspaces, role-based access, 2FA, audit trails and backups.",
    images: [`${BASE_URL}/opengraph-image.png`],
  },
};

export default function SecurityPage() {
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
          <p className="eyebrow-dark">Security &amp; trust</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Your company data stays yours
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            Office Manager is built around isolated company workspaces, role-based access and a clear
            audit trail. This page explains the controls that protect your data.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/#contact"
              className="inline-flex items-center rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-500"
            >
              Ask a security question
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-7 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Read the Privacy Policy
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {CONTROLS.map((control) => (
            <div key={control.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">{control.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{control.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-bold text-slate-900">Responsible disclosure</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            If you believe you have found a security issue, email{" "}
            <a href="mailto:support@pigiecore.co.ke" className="font-semibold text-blue-700 hover:text-blue-600">
              support@pigiecore.co.ke
            </a>{" "}
            with enough detail to reproduce it. Please do not access, modify or expose customer data
            while testing. We will acknowledge the report and coordinate a fix.
          </p>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            Security questions
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
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
