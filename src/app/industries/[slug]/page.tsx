import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/PageShell";
import { INDUSTRIES, getIndustry } from "@/lib/industries";
import { siteUrl } from "@/lib/siteUrl";

const BASE_URL = siteUrl();

export const dynamicParams = false;

export function generateStaticParams() {
  return INDUSTRIES.map((industry) => ({ slug: industry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) return {};

  const title = `${industry.name} Software in Kenya | Office Manager`;
  const url = `${BASE_URL}/industries/${industry.slug}`;

  return {
    title,
    description: industry.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "Office Manager",
      title,
      description: industry.description,
      locale: "en_KE",
      images: [
        {
          url: `${BASE_URL}/opengraph-image.png`,
          width: 1200,
          height: 630,
          alt: `Office Manager for ${industry.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: industry.description,
      images: [`${BASE_URL}/opengraph-image.png`],
    },
  };
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) notFound();

  const related = INDUSTRIES.filter((item) => item.slug !== industry.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: `${industry.name} software in Kenya`,
        url: `${BASE_URL}/industries/${industry.slug}`,
        description: industry.description,
        inLanguage: "en-KE",
        isPartOf: { "@type": "WebSite", name: "Office Manager", url: `${BASE_URL}/` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Industries", item: `${BASE_URL}/industries` },
          {
            "@type": "ListItem",
            position: 3,
            name: industry.name,
            item: `${BASE_URL}/industries/${industry.slug}`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: industry.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
    ],
  };

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
          <p className="eyebrow-dark">{industry.name} · Kenya</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {industry.tagline}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
            {industry.description}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/#contact"
              className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-500"
            >
              Request a callback
            </Link>
            <Link
              href="/industries"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/10 px-7 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              All industries
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              What usually goes wrong
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-600">
              {industry.intro.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <ul className="mt-6 space-y-3">
              {industry.painPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-slate-700">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800"
                  >
                    !
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-lg font-bold text-slate-900">Modules that matter most</h2>
            <ul className="mt-4 space-y-4">
              {industry.modules.map((module) => (
                <li key={module.slug}>
                  <Link
                    href={`/solutions/${module.slug}`}
                    className="font-semibold text-blue-700 hover:text-blue-600"
                  >
                    {module.label}
                  </Link>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{module.reason}</p>
                </li>
              ))}
            </ul>
            <Link
              href="/pricing"
              className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:text-blue-600"
            >
              See plans and pricing →
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">How it works in practice</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
            A typical setup starts with the records that cause the most friction, then expands as the
            team gets comfortable.
          </p>
          <ol className="mt-10 grid gap-5 md:grid-cols-2">
            {industry.workflow.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Questions from {industry.navLabel.toLowerCase()} teams
            </h2>
            <div className="mt-6 space-y-3">
              {industry.faqs.map((faq) => (
                <details key={faq.q} className="group rounded-xl border border-slate-200 bg-white p-5">
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {faq.q}
                      <span
                        aria-hidden="true"
                        className="text-slate-400 transition group-open:rotate-45"
                      >
                        ＋
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <h2 className="text-lg font-bold text-slate-900">Talk to someone who knows the workflow</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Leave a phone number and we&apos;ll call you back. We can walk through your current process,
              recommend a starting module and explain how existing Excel records can be imported.
            </p>
            <Link
              href="/#contact"
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Request a callback
            </Link>
            {industry.guide && (
              <p className="mt-4 text-sm">
                <Link
                  href={industry.guide.href}
                  className="font-semibold text-blue-700 hover:text-blue-600"
                >
                  {industry.guide.label} →
                </Link>
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-lg font-bold text-slate-900">Other industries</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={`/industries/${item.slug}`}
                className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                <span aria-hidden="true" className="mr-2">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
