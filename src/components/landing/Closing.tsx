"use client";

import { useState } from "react";
import Link from "next/link";
import { Reveal } from "./Reveal";
import { SOLUTIONS } from "@/lib/solutions";
import { FAQS } from "@/lib/faqs";
import { PLANS, annualPrice, formatKes } from "@/lib/plans";
import CookieSettingsButton from "@/components/CookieSettingsButton";

/* -------------------------------- Pricing -------------------------------- */

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="section scroll-mt-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-400">
              Priced per business by team size — no hidden charges. Your first month is free, and
              switching to annual billing saves you 5%. Every plan includes free onboarding, Excel
              import, SMS and email notifications, and role-based access.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-8 flex justify-center">
            <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Billing cycle">
              <button
                type="button"
                aria-pressed={!annual}
                onClick={() => setAnnual(false)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  !annual ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                aria-pressed={annual}
                onClick={() => setAnnual(true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  annual ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                Annual · save 5%
              </button>
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.key} delay={0.05 * i}>
              <div
                className={`relative flex h-full flex-col rounded-3xl border p-7 transition ${
                  plan.highlight
                    ? "border-indigo-400/60 bg-indigo-500/[0.08] shadow-2xl shadow-indigo-900/30"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-7 rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-zinc-400">{plan.blurb}</p>

                <div className="mt-6">
                  {plan.monthly === null ? (
                    <p className="text-4xl font-bold text-white">Custom</p>
                  ) : (
                    <>
                      <p className="text-4xl font-bold text-white">
                        {annual ? formatKes(annualPrice(plan.monthly)) : formatKes(plan.monthly)}
                        <span className="text-base font-normal text-zinc-400">
                          {annual ? "/year" : "/mo"}
                        </span>
                      </p>
                      <p className="mt-1 text-xs font-medium text-emerald-400">
                        {annual
                          ? "Save 5% vs paying monthly"
                          : `${formatKes(annualPrice(plan.monthly))}/year — save 5%`}
                      </p>
                    </>
                  )}
                  <p className="mt-3 text-sm text-zinc-300">{plan.usersLabel}</p>
                </div>

                <ul className="mt-6 flex-1 space-y-3 text-sm text-zinc-300">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span aria-hidden className="mt-0.5 text-emerald-400">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.href}
                  className={`mt-8 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition ${
                    plan.highlight
                      ? "btn-grad"
                      : "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-zinc-400">
            All prices in Kenyan Shillings. The first month is free. Subscriptions renew on the 1st of
            each month and are cancelled automatically if not paid. Annual billing is charged upfront
            with a 5% discount.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------- FAQ ---------------------------------- */

export function Faq() {
  return (
    <section id="faq" className="section scroll-mt-36 border-t border-white/5">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <h2 className="text-center text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
            Frequently asked questions
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-8 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20">
                <summary className="cursor-pointer list-none font-semibold text-white marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {f.q}
                    <span aria-hidden="true" className="text-zinc-400 transition group-open:rotate-45">＋</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------- Final CTA ------------------------------- */

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/5">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[720px] max-w-full -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[120px]" />
      <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
            Ready to bring order to your office?
          </h2>
          <p className="mt-4 text-lg text-zinc-300">
            Sign in to your workspace, or ask your admin to set your team up. Credentials arrive by
            email and SMS.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#contact" className="inline-flex items-center rounded-xl bg-white px-7 py-3.5 font-semibold text-zinc-900 shadow-lg shadow-black/20 transition hover:bg-zinc-100 active:scale-[0.98]">
              Request a demo
            </a>
            <Link href="/login" className="inline-flex items-center rounded-xl border border-white/25 bg-white/10 px-7 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/20">
              Sign in
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-400">
            <a href="tel:+254798118515" className="transition hover:text-white">0798 118 515</a>
            <span className="text-zinc-700">·</span>
            <a href="tel:+254708769459" className="transition hover:text-white">0708 769 459</a>
            <span className="text-zinc-700">·</span>
            <a href="mailto:support@pigiecore.co.ke" className="transition hover:text-white">support@pigiecore.co.ke</a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------- Footer --------------------------------- */

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 text-center md:grid-cols-4 md:text-left">
          <div className="md:col-span-1">
            <div className="flex items-center justify-center gap-2 md:justify-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/office-manager-mark.svg" alt="" aria-hidden="true" className="h-10 w-10" />
              <span className="text-lg font-bold tracking-tight text-white">Office Manager</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed">
              All-in-one office management software for Kenyan businesses — payroll, leave, petty cash,
              car logs, meetings and invoicing.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Solutions</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/solutions" className="font-medium text-zinc-300 transition hover:text-indigo-400">
                  All solutions
                </Link>
              </li>
              {SOLUTIONS.slice(0, 6).map((s) => (
                <li key={s.slug}>
                  <Link href={`/solutions/${s.slug}`} className="transition hover:text-indigo-400">{s.title}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link href="/login" className="transition hover:text-indigo-400">Sign in</Link></li>
              <li><a href="#features" className="transition hover:text-indigo-400">Features</a></li>
              <li><a href="#pricing" className="transition hover:text-indigo-400">Pricing</a></li>
              <li><a href="#faq" className="transition hover:text-indigo-400">FAQ</a></li>
              <li><a href="#contact" className="transition hover:text-indigo-400">Contact us</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Get in touch</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="tel:+254798118515" className="transition hover:text-indigo-400">0798 118 515</a></li>
              <li><a href="tel:+254708769459" className="transition hover:text-indigo-400">0708 769 459</a></li>
              <li><a href="mailto:support@pigiecore.co.ke" className="transition hover:text-indigo-400">support@pigiecore.co.ke</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-zinc-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Office Manager · Made for Kenyan businesses</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/terms" className="transition hover:text-indigo-300">Terms &amp; Conditions</Link>
            <Link href="/privacy" className="transition hover:text-indigo-300">Privacy Policy</Link>
            <Link href="/cookie-policy" className="transition hover:text-indigo-300">Cookie Policy</Link>
            <CookieSettingsButton className="transition hover:text-indigo-300">Cookie settings</CookieSettingsButton>
            <a href="https://pigiecore.co.ke" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-400 transition hover:text-indigo-300">
              Powered by PigieCore Solutions
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
