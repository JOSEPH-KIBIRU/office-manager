import Link from "next/link";
import { notFound } from "next/navigation";
import { SOLUTIONS, getSolution } from "@/lib/solutions";
import { getSolutionPageJsonLd } from "@/lib/seo";

// static paths aren't required; every slug is validated at render time

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  const more = SOLUTIONS.filter((s) => s.slug !== solution.slug);

  return (
    <main className="min-h-screen bg-white text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getSolutionPageJsonLd(solution)) }}
      />

      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white">
              OM
            </span>
            <span className="font-semibold tracking-tight text-slate-900">Office Manager</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/?solution=${solution.slug}#contact`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Get started
            </Link>
            <Link href="/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/20 text-3xl text-blue-300 ring-1 ring-blue-500/30">
            {solution.icon}
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {solution.title}
          </h1>
          <p className="mt-3 text-lg font-medium text-blue-200">{solution.tagline}</p>
          <Link
            href={`/?solution=${solution.slug}#contact`}
            className="mt-8 inline-block rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white shadow-lg transition hover:bg-blue-500"
          >
            Talk to us about {solution.navLabel.toLowerCase()}
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl px-4 py-20">
        <p className="inline-block rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          How it works
        </p>
        <p className="mt-6 text-lg leading-relaxed text-slate-700">{solution.summary}</p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {solution.features.map((f) => (
            <div key={f} className="card flex items-start gap-3 p-5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                ✓
              </span>
              <p className="text-sm text-slate-700">{f}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Ready to see {solution.navLabel.toLowerCase()} in action?
          </h2>
          <p className="mt-2 text-slate-600">
            Tell us about your office and we&apos;ll show you exactly how it fits.
          </p>
          <Link
            href={`/?solution=${solution.slug}#contact`}
            className="mt-6 inline-block rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white transition hover:bg-blue-500"
          >
            Request a demo
          </Link>
        </div>
      </section>

      {/* More solutions */}
      {more.length > 0 && (
        <section className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
              Explore more solutions
            </h2>
            <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((s) => (
                <Link
                  key={s.slug}
                  href={`/solutions/${s.slug}`}
                  className="card group p-5 transition hover:border-blue-300 hover:shadow-md"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700">
                    {s.icon}
                  </span>
                  <p className="mt-3 font-semibold text-slate-900 group-hover:text-blue-700">{s.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{s.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-slate-950 py-10 text-center text-sm text-slate-400">
        <div className="mx-auto max-w-6xl px-4">
          <Link href="/" className="font-semibold text-white hover:text-blue-400">
            ← Back to Office Manager
          </Link>
          <p className="mt-3 text-xs text-slate-500">
            Made and powered by
            <a href="https://pigiecore.co.ke" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-400 hover:text-blue-300">
              PigieCore Solutions
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
