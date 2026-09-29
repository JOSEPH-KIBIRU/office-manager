"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  fadeInUpStrong,
  scaleIn,
  staggerContainer,
  staggerItem,
  viewportOnce,
  hoverScale,
  tapScale,
} from "@/lib/motion";
import GlowOrbits from "./GlowOrbits";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-6 pb-12 lg:pt-10 lg:pb-16">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_50%_at_20%_0%,rgba(79,70,229,0.22),transparent_60%),radial-gradient(50%_45%_at_95%_10%,rgba(56,189,248,0.12),transparent_60%)]" />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:px-8">
        {/* Copy */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left"
        >
          <motion.div variants={staggerItem} className="mb-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-sm font-medium text-zinc-200 backdrop-blur">
              AI meeting minutes, now included
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUpStrong}
            className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]"
          >
            Run your whole office{" "}
            <span className="text-grad-light">from one secure workspace</span>
          </motion.h1>

          <motion.p variants={staggerItem} className="mt-6 text-lg leading-relaxed text-zinc-400">
            Payroll, leave, expenses, invoices, accounting, tasks and everyday operations — without
            the spreadsheets and paperwork. Built for Kenyan businesses.
          </motion.p>

          <motion.div
            variants={staggerItem}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
          >
            <motion.div whileHover={hoverScale} whileTap={tapScale}>
              <Link
                href="#contact"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-600 px-7 text-base font-medium text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-500"
              >
                Request a Free Demo
              </Link>
            </motion.div>

            <motion.div whileHover={hoverScale} whileTap={tapScale}>
              <Link
                href="#product-tour"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 text-base font-medium text-white backdrop-blur transition hover:bg-white/10"
              >
                See product tour
              </Link>
            </motion.div>
          </motion.div>

          <motion.p variants={staggerItem} className="mt-7 text-sm text-zinc-500">
            KRA-ready payroll · Isolated workspaces · Built for Kenyan SMEs
          </motion.p>
        </motion.div>

        {/* Right visual — glowing orbits of the workspace modules */}
        <motion.div
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="relative mx-auto w-full max-w-2xl lg:max-w-none"
        >
          <GlowOrbits />
        </motion.div>
      </div>
    </section>
  );
}
