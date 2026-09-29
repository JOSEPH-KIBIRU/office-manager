"use client";

import type { ReactNode } from "react";
import { Reveal, Stagger, StaggerItem, HoverCard } from "./Reveal";

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICONS = {
  users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  finance: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
  ops: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z",
  shield: "M12 2.5 3.5 6v5c0 4.6 3.6 8.7 8.5 10 4.9-1.3 8.5-5.4 8.5-10V6L12 2.5Z",
  check: "M5 13l4 4L19 7",
};

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-lg leading-relaxed text-zinc-400">{sub}</p>}
    </div>
  );
}

/* ------------------------------ Logo strip ------------------------------ */

const SECTORS = ["Retail", "Logistics", "Professional services", "Hospitality", "Manufacturing", "NGOs"];

export function LogoStrip() {
  const row = (ariaHidden: boolean) => (
    <ul
      className="flex shrink-0 items-center gap-8 pr-8 sm:gap-12 sm:pr-12"
      aria-hidden={ariaHidden || undefined}
    >
      {SECTORS.map((s) => (
        <li key={s} className="flex items-center gap-8 sm:gap-12">
          <span className="whitespace-nowrap text-lg font-semibold tracking-tight text-zinc-400">{s}</span>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-indigo-400/50" />
        </li>
      ))}
    </ul>
  );

  return (
    <section className="border-y border-white/5 py-9">
      <p className="mx-auto max-w-7xl px-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:px-6">
        Built for teams across every sector in Kenya
      </p>
      {/* Full-width marquee — the sector list scrolls continuously */}
      <div className="relative mt-6 overflow-hidden">
        <div className="marquee-track flex w-max">
          {row(false)}
          {row(true)}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-zinc-950 to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-zinc-950 to-transparent sm:w-28" />
      </div>
    </section>
  );
}

/* ----------------------------- Value props ----------------------------- */

const VALUES = [
  { icon: ICONS.users, title: "HR & People", body: "Staff records, roles, departments and leave — one source of truth." },
  { icon: ICONS.finance, title: "Finance & Payroll", body: "KRA-ready payroll, accounting, invoicing, bills and expenses that reconcile." },
  { icon: ICONS.ops, title: "Operations", body: "Meetings, minutes, tasks, vehicles and day-to-day admin, kept organised." },
  { icon: ICONS.shield, title: "Compliance & Control", body: "Approvals, audit trails and per-company data isolation built in." },
];

export function ValueProps() {
  return (
    <section className="section pb-6 sm:pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="The platform"
            title={
              <>
                One workspace. <span className="text-grad">Zero chaos.</span>
              </>
            }
            sub="Replace scattered spreadsheets, paperwork and disconnected tools with one secure place to run your office."
          />
        </Reveal>

        <Stagger className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <StaggerItem key={v.title}>
              <HoverCard className="card-premium h-full p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300">
                  <Icon d={v.icon} />
                </span>
                <h3 className="mt-5 text-base font-semibold text-white">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{v.body}</p>
              </HoverCard>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* --------------------------- Kenya compliance --------------------------- */

const STATUTORY = [
  { label: "PAYE", note: "Correct KRA tax bands" },
  { label: "NSSF", note: "National Social Security Fund" },
  { label: "SHIF", note: "Social Health Insurance Fund" },
  { label: "Housing Levy", note: "Affordable Housing Levy (1.5%)" },
  { label: "HELB", note: "Where applicable" },
];

export function Compliance() {
  return (
    <section id="payroll" className="section scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow">Kenya compliance</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
              Stay compliant without the spreadsheets.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-400">
              Statutory deductions are computed in one central payroll configuration and kept current
              as KRA, NSSF and SHIF regulations change.
            </p>
            <ul className="mt-6 space-y-3">
              {STATUTORY.map((s) => (
                <li key={s.label} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <Icon d={ICONS.check} className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{s.label}</p>
                    <p className="text-sm text-zinc-500">{s.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
              <div className="rounded-2xl border border-white/10 bg-[#0b0b12] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sample payslip · March 2026</p>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Ready to print</span>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    ["Basic pay", "KSh 75,000.00"],
                    ["NSSF", "KSh 4,500.00"],
                    ["SHIF", "KSh 2,062.50"],
                    ["Housing Levy", "KSh 1,125.00"],
                    ["PAYE", "KSh 12,577.08"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-white/5 py-1.5 text-sm">
                      <span className="text-zinc-500">{k}</span>
                      <span className="font-medium text-zinc-200">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 text-sm font-bold text-emerald-400">
                    <span>Net pay</span>
                    <span>KSh 54,735.39</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ How it works ------------------------------ */

const STEPS = [
  { n: "01", title: "Request a demo", body: "Tell us about your team and the modules you need. We'll show you around." },
  { n: "02", title: "We set up your workspace", body: "Your company, chart of accounts, staff and roles are configured for you." },
  { n: "03", title: "Run your office", body: "Your team signs in and runs HR, payroll, finance and operations from one place." },
];

export function HowItWorks() {
  return (
    <section className="section">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow="Getting started" title="Live in three simple steps" />
        </Reveal>
        <Stagger className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <StaggerItem key={s.n}>
              <div className="relative h-full rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                <span className="text-sm font-bold tracking-[0.2em] text-indigo-400">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* -------------------------------- Security -------------------------------- */

const SECURITY = [
  "Each company gets a fully isolated workspace",
  "Role-based access — Admin, Secretary, Manager, Employee",
  "Passwords hashed with bcrypt",
  "Signed, httpOnly session cookies (JWT)",
  "HTTPS in production",
  "Data stored securely in the cloud, with regular backups",
];

export function SecuritySection() {
  return (
    <section id="security" className="section scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow">Security</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
              Isolation you can trust.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-400">
              Every organization is a separate workspace. Roles, records and requests stay completely
              separated — your data never bleeds into another company.
            </p>
            <ul className="mt-6 grid gap-2.5 text-sm sm:grid-cols-2">
              {SECURITY.map((item) => (
                <li key={item} className="flex items-start gap-2 text-zinc-300">
                  <span className="mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <Icon d={ICONS.check} className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-xs font-semibold text-zinc-500">How isolation works</p>
              <div className="mt-4 space-y-3">
                {[
                  { name: "Your workspace", desc: "All staff, requests and records stay here", on: true },
                  { name: "Another company", desc: "Completely separate — no shared data", on: false },
                ].map((w) => (
                  <div
                    key={w.name}
                    className={`flex items-center gap-3 rounded-2xl border p-4 ${
                      w.on ? "border-indigo-500/30 bg-indigo-500/10" : "border-white/10 bg-white/[0.02] opacity-70"
                    }`}
                  >
                    <span className={`grid h-9 w-9 flex-none place-items-center rounded-lg text-xs font-bold ${w.on ? "bg-indigo-600 text-white" : "bg-white/10 text-zinc-400"}`}>
                      {w.on ? "Y" : "X"}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{w.name}</p>
                      <p className="text-xs text-zinc-500">{w.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
