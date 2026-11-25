import Link from "next/link";
import { GUIDES, type Guide } from "@/lib/guides";
import { getSolution } from "@/lib/solutions";
import { siteUrl } from "@/lib/siteUrl";
import { formatDate } from "@/lib/format";

const BASE_URL = siteUrl();

export default function GuideArticle({ guide }: { guide: Guide }) {
  const relatedSolutions = guide.relatedSolutions
    .map((s) => getSolution(s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const relatedGuides = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        datePublished: guide.updated,
        dateModified: guide.updated,
        articleSection: guide.category,
        inLanguage: "en-KE",
        author: { "@type": "Organization", name: "Office Manager" },
        publisher: {
          "@type": "Organization",
          name: "Office Manager",
          logo: { "@type": "ImageObject", url: `${BASE_URL}/icon-512.png` },
        },
        mainEntityOfPage: `${BASE_URL}/resources/${guide.slug}`,
        image: `${BASE_URL}/opengraph-image.png`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Resources", item: `${BASE_URL}/resources` },
          { "@type": "ListItem", position: 3, name: guide.title, item: `${BASE_URL}/resources/${guide.slug}` },
        ],
      },
      ...(guide.faqs.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: guide.faqs.map((faq) => ({
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: { "@type": "Answer", text: faq.a },
              })),
            },
          ]
        : []),
    ],
  };

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
            <Link href="/resources" className="hidden text-sm font-medium text-slate-600 hover:text-blue-700 sm:block">
              Guides
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
        <div className="relative mx-auto max-w-4xl px-4 py-16 sm:py-20">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
            <Link href="/" className="hover:text-white">Home</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <Link href="/resources" className="hover:text-white">Resources</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <span className="text-slate-300">{guide.category}</span>
          </nav>
          <p className="mt-6 inline-block rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-200">
            {guide.category}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {guide.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-300">{guide.intro}</p>
          <p className="mt-5 text-sm text-slate-400">
            Updated {formatDate(guide.updated)} · {guide.readingTime} · By the Office Manager team
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="no-print hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">In this guide</p>
              <ol className="mt-3 space-y-2 text-sm text-slate-600">
                {guide.sections.map((section, index) => (
                  <li key={section.heading}>
                    <a href={`#section-${index + 1}`} className="hover:text-blue-700">
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="space-y-10">
              {guide.sections.map((section, index) => (
                <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-28">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">{section.heading}</h2>
                  <div className="mt-3 space-y-4 text-[15px] leading-7 text-slate-600">
                    {section.body.map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="space-y-2 pl-5">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="list-disc">
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              ))}
            </div>

            {guide.faqs.length > 0 && (
              <section className="mt-12 border-t border-slate-200 pt-10">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Frequently asked questions</h2>
                <div className="mt-5 space-y-3">
                  {guide.faqs.map((faq) => (
                    <details key={faq.q} className="group rounded-xl border border-slate-200 bg-white p-4">
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
              </section>
            )}

            <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <h2 className="text-xl font-bold text-slate-900">Want help applying this in your office?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Leave your phone number and we&apos;ll call you back. We&apos;ll answer your questions
                and show you the relevant modules — no long forms, no obligation.
              </p>
              <Link
                href="/#contact"
                className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Request a callback
              </Link>
            </div>

            {relatedSolutions.length > 0 && (
              <section className="mt-12 border-t border-slate-200 pt-8">
                <h2 className="text-lg font-bold text-slate-900">Related solutions</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {relatedSolutions.map((solution) => (
                    <Link
                      key={solution.slug}
                      href={`/solutions/${solution.slug}`}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
                    >
                      <span className="text-xl">{solution.icon}</span>
                      <p className="mt-2 font-semibold text-slate-900">{solution.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{solution.tagline}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-12 border-t border-slate-200 pt-8">
              <h2 className="text-lg font-bold text-slate-900">Keep reading</h2>
              <div className="mt-4 space-y-3">
                {relatedGuides.map((other) => (
                  <Link
                    key={other.slug}
                    href={`/resources/${other.slug}`}
                    className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{other.category}</p>
                    <p className="mt-1 font-semibold text-slate-900">{other.title}</p>
                  </Link>
                ))}
              </div>
            </section>

            <p className="mt-10 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
              This guide is general information, not legal, tax or accounting advice. Confirm current
              rates and requirements with KRA, the relevant authority or your professional adviser.
            </p>
          </div>
        </div>
      </article>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Office Manager · Made for Kenyan businesses</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-blue-700">Home</Link>
            <Link href="/resources" className="hover:text-blue-700">Guides</Link>
            <Link href="/solutions" className="hover:text-blue-700">Solutions</Link>
            <Link href="/#contact" className="hover:text-blue-700">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
