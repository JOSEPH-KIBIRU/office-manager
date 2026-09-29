"use client";

import { motion } from "framer-motion";
import {
  WalletCards,
  CalendarCheck2,
  Banknote,
  Sparkles,
  CarFront,
  ReceiptText,
  ChartNoAxesCombined,
  ListTodo,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  Package,
  UserCheck,
} from "lucide-react";

import { staggerContainer, staggerItem, viewportOnce, cardHoverSoft } from "@/lib/motion";

type Feature = {
  title: string;
  description: string;
  icon: React.ElementType;
  iconClass: string;
  badge?: string;
  featured?: boolean;
  /** Explicit responsive translate, so adding a card never shifts the layout. */
  offset?: string;
  content: React.ReactNode;
};

const features: Feature[] = [
  {
    title: "Payroll",
    description:
      "KRA-ready payroll with PAYE, NSSF, SHIF, Housing Levy and HELB built in, plus casuals, per diem, overtime, staff loans and leave encashment.",
    icon: WalletCards,
    iconClass: "text-indigo-400",
    badge: "Automated",
    featured: true,
    offset: "lg:translate-y-8",
    content: (
      <div className="mt-7 rounded-2xl border border-white/[0.07] bg-black/30 p-4 shadow-inner">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Payroll · September</span>
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Ready
          </span>
        </div>

        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>Gross pay</span>
            <span className="text-zinc-300">KES 150,010</span>
          </div>

          <div className="flex justify-between text-zinc-400">
            <span>PAYE</span>
            <span className="text-zinc-300">KES 33,530</span>
          </div>

          <div className="flex justify-between text-zinc-400">
            <span>NSSF · SHIF · Housing</span>
            <span className="text-zinc-300">KES 12,855</span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
            <span className="font-medium text-white">Net pay</span>
            <span className="font-semibold text-white">KES 101,125</span>
          </div>
        </div>
      </div>
    ),
  },

  {
    title: "Leave & Approvals",
    description:
      "Employees request leave and managers approve it in one workspace — with working-day deduction, a shared calendar, carry-over and end-of-year encashment.",
    icon: CalendarCheck2,
    iconClass: "text-cyan-400",
    badge: "Simple",
    content: (
      <div className="mt-7 space-y-3 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-200">J. Otieno</p>
            <p className="mt-0.5 text-xs text-zinc-500">Annual leave · 3 days</p>
          </div>

          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            Approved
          </span>
        </div>

        <div className="border-t border-white/[0.06] pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-200">A. Wanjiru</p>
              <p className="mt-0.5 text-xs text-zinc-500">Sick leave · 1 day</p>
            </div>

            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400">
              Pending
            </span>
          </div>
        </div>
      </div>
    ),
  },

  {
    title: "Petty Cash",
    description: "Know exactly where office money goes with real-time cash tracking.",
    icon: Banknote,
    iconClass: "text-emerald-400",
    content: (
      <div className="mt-7 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        <p className="text-xs text-zinc-500">Available float</p>

        <div className="mt-1 flex items-end justify-between">
          <span className="text-2xl font-semibold tracking-tight text-white">KES 42,300</span>

          <span className="text-xs text-emerald-400">+8.4%</span>
        </div>

        <div className="mt-5 space-y-2.5 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>Transport</span>
            <span className="text-red-400">-1,200</span>
          </div>

          <div className="flex justify-between text-zinc-400">
            <span>Stationery</span>
            <span className="text-red-400">-850</span>
          </div>
        </div>
      </div>
    ),
  },

  {
    title: "Meetings + AI Minutes",
    offset: "lg:-translate-y-2",
    description: "Capture meeting discussions and turn them into professional minutes in seconds.",
    icon: Sparkles,
    iconClass: "text-violet-400",
    badge: "AI-powered",
    featured: true,
    content: (
      <div className="mt-7 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/80 p-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-[11px] text-zinc-500">10:30 AM · Meeting</span>
          </div>

          <p className="mt-2 text-sm leading-5 text-zinc-400">
            Budget review, supplier follow-up and Q4 planning...
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-200">AI minutes generated</p>
            <p className="text-[11px] text-zinc-500">Decisions · Actions · Owners</p>
          </div>
        </div>
      </div>
    ),
  },

  {
    title: "Vehicle Logs",
    description: "Track servicing, repairs, insurance and vehicle history without paperwork.",
    icon: CarFront,
    iconClass: "text-sky-400",
    content: (
      <div className="mt-7 space-y-3 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        {[
          ["KDA 123A", "Serviced", "emerald"],
          ["KCB 456B", "Due soon", "amber"],
        ].map(([vehicle, status, color]) => (
          <div key={vehicle} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
                <CarFront className="h-4 w-4 text-zinc-500" />
              </div>

              <span className="text-sm text-zinc-300">{vehicle}</span>
            </div>

            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                color === "emerald" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
              }`}
            >
              {status}
            </span>
          </div>
        ))}
      </div>
    ),
  },

  {
    title: "Invoicing",
    description:
      "Create professional invoices, monitor payments, file to KRA eTIMS and chase overdue balances with automatic SMS and email reminders.",
    icon: ReceiptText,
    iconClass: "text-orange-400",
    content: (
      <div className="mt-7 space-y-3 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-200">INV-0042</p>
            <p className="mt-0.5 text-xs text-zinc-500">KES 84,500</p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Paid
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-200">INV-0043</p>
              <p className="mt-0.5 text-xs text-zinc-500">KES 42,000</p>
            </div>

            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-400">Pending</span>
          </div>
        </div>
      </div>
    ),
  },

  {
    title: "Accounting",
    offset: "lg:translate-y-16",
    description: "Keep your ledger, trial balance, P&L and balance sheet connected in one place.",
    icon: ChartNoAxesCombined,
    iconClass: "text-emerald-400",
    badge: "New",
    featured: true,
    content: (
      <div className="mt-7 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Business overview</span>
          <ArrowUpRight className="h-4 w-4 text-zinc-600" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/[0.025] p-3">
            <p className="text-[11px] text-zinc-500">Revenue</p>
            <p className="mt-1 text-sm font-medium text-white">KES 1.24M</p>
          </div>

          <div className="rounded-xl bg-white/[0.025] p-3">
            <p className="text-[11px] text-zinc-500">Expenses</p>
            <p className="mt-1 text-sm font-medium text-white">KES 610K</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3">
          <span className="text-sm text-zinc-400">Net profit</span>
          <span className="text-sm font-semibold text-emerald-400">KES 630K</span>
        </div>
      </div>
    ),
  },

  {
    title: "Tasks",
    description: "Assign work, monitor progress and keep everyone accountable.",
    icon: ListTodo,
    iconClass: "text-pink-400",
    content: (
      <div className="mt-7 space-y-3 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-300">Quarterly report</p>
            <p className="text-[11px] text-zinc-500">Submitted</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <ListTodo className="h-3.5 w-3.5 text-amber-400" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-300">Fix printer</p>
            <p className="text-[11px] text-zinc-500">Open</p>
          </div>
        </div>
      </div>
    ),
  },

  {
    title: "Attendance",
    offset: "lg:translate-y-8",
    description:
      "A one-tap time clock with automatic late detection, grace periods and monthly attendance summaries per employee.",
    icon: Clock3,
    iconClass: "text-sky-400",
    badge: "New",
    content: (
      <div className="mt-7 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Today · time clock</span>
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Clocked in
          </span>
        </div>

        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>Clock in</span>
            <span className="text-zinc-300">08:04</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Status</span>
            <span className="text-emerald-400">On time</span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
            <span className="font-medium text-white">This month</span>
            <span className="font-semibold text-white">21 / 22 days</span>
          </div>
        </div>
      </div>
    ),
  },

  {
    title: "Documents",
    description:
      "Keep contracts, IDs and certificates in one register, and get alerted before anything expires.",
    icon: FileText,
    iconClass: "text-teal-400",
    content: (
      <div className="mt-7 space-y-3 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-200">Work permit · A. Wanjiru</p>
            <p className="mt-0.5 text-xs text-amber-400">Expires in 12 days</p>
          </div>

          <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400">
            Expiring
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-200">NHIF medical card</p>
            <p className="mt-0.5 text-xs text-zinc-500">Valid</p>
          </div>

          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            Valid
          </span>
        </div>
      </div>
    ),
  },

  {
    title: "Assets & Custody",
    offset: "lg:-translate-y-2",
    description:
      "Register laptops, phones and equipment, and keep a full checkout and return trail for every item.",
    icon: Package,
    iconClass: "text-lime-400",
    content: (
      <div className="mt-7 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        <p className="text-xs text-zinc-500">Asset register</p>

        <div className="mt-3 space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Total assets</span>
            <span className="font-medium text-zinc-200">148</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">With staff</span>
            <span className="font-medium text-zinc-200">62</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">In store</span>
            <span className="font-medium text-zinc-200">86</span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
            <span className="font-medium text-white">Needs servicing</span>
            <span className="font-semibold text-amber-400">4</span>
          </div>
        </div>
      </div>
    ),
  },

  {
    title: "Visitor Log",
    description:
      "Record every visitor with host, purpose and optional vehicle registration, and report on footfall.",
    icon: UserCheck,
    iconClass: "text-violet-400",
    content: (
      <div className="mt-7 space-y-3 rounded-2xl border border-white/[0.07] bg-black/30 p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-200">Brian K · Supplier</p>
            <p className="mt-0.5 text-xs text-zinc-500">KDA 412G · Host: Sales</p>
          </div>

          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            Checked in
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-200">Mercy A · Auditor</p>
            <p className="mt-0.5 text-xs text-zinc-500">KCT 908B · Host: Finance</p>
          </div>

          <span className="shrink-0 rounded-full bg-zinc-500/10 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            Signed out
          </span>
        </div>
      </div>
    ),
  },
];

export default function FeatureBento() {
  return (
    <section id="features" className="relative section scroll-mt-20 overflow-hidden pt-6 sm:pt-8">
      {/* Background atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-40 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-indigo-500/[0.035] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section heading */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            variants={staggerItem}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-1.5 text-xs font-medium text-indigo-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            One workspace. Every workflow.
          </motion.div>

          <motion.h2
            variants={staggerItem}
            className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl"
          >
            Everything your office needs.
            <br />
            <span className="text-zinc-500">One platform.</span>
          </motion.h2>

          <motion.p
            variants={staggerItem}
            className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg"
          >
            Replace scattered tools and paperwork with one secure workspace for payroll, accounting,
            approvals, operations and more.
          </motion.p>
        </motion.div>

        {/* Cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6"
        >
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <motion.article
                key={feature.title}
                variants={staggerItem}
                whileHover={cardHoverSoft}
                className={[
                  "group relative overflow-hidden rounded-[1.75rem]",
                  "border border-white/[0.08]",
                  "bg-zinc-950/75",
                  "p-6 sm:p-7",
                  "shadow-2xl shadow-black/20",
                  "transition-colors duration-500",
                  "hover:border-indigo-400/20",
                  feature.offset ?? "",
                ].join(" ")}
              >
                {/* Top-right ambient glow */}
                <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-indigo-500/[0.07] blur-3xl transition-all duration-700 group-hover:bg-indigo-500/[0.13]" />

                {/* Bottom glow */}
                <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-blue-500/[0.035] blur-3xl" />

                {/* Content */}
                <div className="relative">
                  {/* Icon + badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] shadow-inner">
                      <Icon className={`h-[19px] w-[19px] ${feature.iconClass}`} strokeWidth={1.7} />
                    </div>

                    {feature.badge && (
                      <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        {feature.badge}
                      </span>
                    )}
                  </div>

                  {/* Heading */}
                  <div className="mt-6">
                    <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">{feature.title}</h3>

                    <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">{feature.description}</p>
                  </div>

                  {/* Product preview */}
                  {feature.content}
                </div>

                {/* Fine inner border */}
                <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/[0.025] transition-all duration-500 group-hover:ring-indigo-400/[0.08]" />
              </motion.article>
            );
          })}
        </motion.div>

        {/* Bottom statement */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-20 text-center lg:mt-28"
        >
          <p className="text-sm text-zinc-500">Built to replace spreadsheets, paperwork and disconnected tools.</p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-600">
            <span>Payroll</span>
            <span className="hidden sm:block">•</span>
            <span>Accounting</span>
            <span className="hidden sm:block">•</span>
            <span>Operations</span>
            <span className="hidden sm:block">•</span>
            <span>HR</span>
            <span className="hidden sm:block">•</span>
            <span>AI</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
