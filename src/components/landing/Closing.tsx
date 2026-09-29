"use client";

import Link from "next/link";
import { Reveal } from "./Reveal";
import { SOLUTIONS } from "@/lib/solutions";
import { FAQS } from "@/lib/faqs";
import CookieSettingsButton from "@/components/CookieSettingsButton";

/* -------------------------------- Pricing -------------------------------- */

export function Pricing() {
  return (
    <section id="pricing" className="section scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-400">
              Office Manager is built for growing Kenyan businesses. Pricing is based on your team size
              and the modules you need — no hidden charges.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mx-auto mt-10 max-w-lg rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-sm font-semibold text-white">Request a demo and get a tailored quote</p>
            <p className="mt-2 text-sm text-zinc-400">
              We&apos;ll walk through the platform with you, answer your questions, and put together a
              pricing plan that fits your office.
            </p>
            <a href="#contact" className="btn-grad mt-6">
              Request a Free Demo
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------- FAQ ---------------------------------- */

export function Faq() {
  return (
    <section id="faq" className="section scroll-mt-20 border-t border-white/5">
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
                    <span className="text-zinc-500 transition group-open:rotate-45">＋</span>
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
              Request a Free Demo
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
            <div className="flex items-center justify-center md:justify-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/office-manager-logo.svg" alt="Office Manager" className="h-14 w-auto" />
            </div>
            <p className="mt-4 text-sm leading-relaxed">
              All-in-one office management software for Kenyan businesses — payroll, leave, petty cash,
              car logs, meetings and invoicing.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Solutions</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {SOLUTIONS.map((s) => (
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

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-zinc-500 sm:flex-row">
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
