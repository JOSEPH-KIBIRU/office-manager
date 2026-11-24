"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  fadeInUpStrong,
  staggerContainer,
  staggerItem,
  viewportOnce,
  hoverScale,
  tapScale,
} from "@/lib/motion";

export default function Hero() {
  return (
    <section className="relative flex min-h-[560px] items-center overflow-hidden py-16 sm:py-20 lg:min-h-[660px] lg:py-28">
      {/* Real office photography as the hero backdrop */}
      <div className="absolute inset-0 -z-20">
        <Image
          src="/images/hero/office-working.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          quality={82}
          className="object-cover object-center"
        />
      </div>
      {/* Layered overlays keep the copy readable and the brand colours intact. */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-zinc-950/70" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-zinc-950/25" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/20" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_20%_10%,rgba(79,70,229,0.18),transparent_65%)]" />

      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        {/* Copy */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left"
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
                Request a demo
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

          <motion.p variants={staggerItem} className="mt-7 text-sm text-zinc-400">
            KRA-ready payroll · Isolated workspaces · Free onboarding &amp; Excel import
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
