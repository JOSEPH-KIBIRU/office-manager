import type { Metadata } from "next";
import LandingHeader from "@/components/LandingHeader";
import ProductShowcase from "@/components/ProductShowcase";
import ContactForm from "@/components/ContactForm";
import Hero from "@/components/landing/Hero";
import FeatureBento from "@/components/landing/FeatureBento";
import ModuleGrid, { ALL_MODULE_NAMES } from "@/components/landing/ModuleGrid";
import BackToTop from "@/components/landing/BackToTop";
import { LogoStrip, ValueProps, Compliance, HowItWorks, MigrationSection, SecuritySection } from "@/components/landing/Sections";
import { Pricing, Faq, FinalCta, SiteFooter } from "@/components/landing/Closing";
import { siteUrl } from "@/lib/siteUrl";
import { FAQS } from "@/lib/faqs";

const BASE_URL = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Office Manager | Payroll & Office Software Kenya",
  description:
    "All-in-one office management software for Kenyan SMEs: KRA-ready payroll, leave, attendance, accounting, invoicing, eTIMS and more. Request a demo.",
  keywords: [
    "office management software Kenya",
    "office management system Kenya",
    "HR software Kenya",
    "payroll software Kenya",
    "KRA compliant payroll Kenya",
    "employee leave management Kenya",
    "petty cash management software",
    "accounting software Kenya",
    "task management software Kenya",
    "business management software Kenya",
    "SME software Kenya",
    "NSSF SHIF payroll software",
    "office admin software Nairobi",
    "attendance management software Kenya",
    "employee document management Kenya",
    "asset register management software",
    "visitor management system",
    "KRA eTIMS e-invoicing software",
    "e-invoicing Kenya KRA integration",
    "human resource management system Kenya",
    "staff leave carry over encashment",
    "organizational chart software",
    "double entry accounting software Kenya",
  ],
  alternates: { canonical: `${BASE_URL}/` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/`,
    siteName: "Office Manager",
    title: "Office Manager | Payroll & Office Software Kenya",
    description:
      "KRA-ready payroll, leave, attendance, accounting, invoicing and eTIMS for Kenyan SMEs. One secure workspace. Request a demo.",
    locale: "en_KE",
    countryName: "Kenya",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Office Manager — all-in-one office management for Kenyan SMEs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Office Manager | Payroll & Office Software Kenya",
    description:
      "KRA-ready payroll, leave, attendance, accounting, invoicing and eTIMS for Kenyan SMEs.",
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        alt: "Office Manager — all-in-one office management for Kenyan SMEs",
      },
    ],
  },
  robots: { index: true, follow: true },
  category: "business",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Office Manager",
      url: `${BASE_URL}/`,
      logo: `${BASE_URL}/icon-512.png`,
      description:
        "All-in-one office management software for Kenyan businesses — payroll, leave, attendance, documents, assets, visitors, petty cash, car logs, meetings, invoicing, KRA eTIMS e-invoicing, accounting and tasks.",
      address: { "@type": "PostalAddress", addressCountry: "KE" },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+254798118515",
        contactType: "sales",
        areaServed: "KE",
        availableLanguage: ["en"],
      },
      areaServed: "Kenya",
    },
    {
      "@type": "WebSite",
      name: "Office Manager",
      url: `${BASE_URL}/`,
      inLanguage: "en-KE",
      publisher: { "@type": "Organization", name: "Office Manager" },
    },
    {
      "@type": "SoftwareApplication",
      name: "Office Manager",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${BASE_URL}/`,
      screenshot: `${BASE_URL}/opengraph-image.png`,
      description:
        "KRA-compliant payroll, employee leave management, attendance, document and asset registers, visitor management, petty cash, car logs, meetings, invoicing with KRA eTIMS e-invoicing, double-entry accounting and task tracking software for Kenyan businesses.",
      publisher: { "@type": "Organization", name: "PigieCore Solutions" },
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "3500",
        highPrice: "8000",
        priceCurrency: "KES",
        offerCount: "2",
        availability: "https://schema.org/InStock",
      },
      countriesSupported: "KE",
      featureList: ALL_MODULE_NAMES,
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` }],
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

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ solution?: string }> }) {
  const { solution: solutionParam } = await searchParams;
  const solution = solutionParam?.length ? solutionParam : undefined;

  return (
    <main id="top" className="min-h-screen bg-zinc-950 text-zinc-300">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <LandingHeader />

      <Hero />
      <LogoStrip />
      <ValueProps />
      <FeatureBento />
      <ModuleGrid />
      <Compliance />
      <ProductShowcase />
      <HowItWorks />
      <MigrationSection />
      <SecuritySection />
      <Pricing />
      <Faq />
      <FinalCta />

      {/* Contact */}
      <section id="contact" className="section scroll-mt-36 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Request a demo</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
                Request a callback
              </h2>
              <p className="mt-4 text-zinc-400">
                Leave your phone number and we&apos;ll call you back within one business hour. No long
                forms, no obligation — just a quick conversation about your office.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  { label: "Call us", value: "0798 118 515 · 0708 769 459", href: "tel:+254798118515" },
                  { label: "Email", value: "support@pigiecore.co.ke", href: "mailto:support@pigiecore.co.ke" },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{c.label}</p>
                      <a href={c.href} className="text-sm font-semibold text-zinc-200 transition hover:text-indigo-300">{c.value}</a>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a9 9 0 0 0 0-18m0 18c2.5 0 4.5-4.03 4.5-9S14.5 3 12 3m0 18c-2.5 0-4.5-4.03-4.5-9S9.5 3 12 3" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Powered by</p>
                    <a href="https://pigiecore.co.ke" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300">
                      PigieCore Solutions
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="landing-form rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <ContactForm initialSolution={solution} />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      <BackToTop />
    </main>
  );
}
