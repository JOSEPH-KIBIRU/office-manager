"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PublicAnnouncementBanner from "@/components/PublicAnnouncementBanner";

const NAV = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "Modules", href: "#modules" },
  { label: "Payroll", href: "#payroll" },
  { label: "Pricing", href: "#pricing" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "#faq" },
];

export default function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const transparent = pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkCls = "text-zinc-300 hover:bg-white/10 hover:text-white";

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        transparent
          ? "border-b border-transparent bg-transparent"
          : "border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl"
      }`}
    >
      {/* Announcement lives inside the navbar strip (full-bleed, frameless) */}
      <PublicAnnouncementBanner />
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Office Manager" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/office-manager-logo.svg" alt="Office Manager" className="h-12 w-auto" />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV.map((l) => (
            <a key={l.label} href={l.href} className={`rounded-lg px-3.5 py-2 text-[15px] font-medium transition ${linkCls}`}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className={`rounded-lg px-4 py-2 text-[15px] font-medium transition ${
              transparent ? "text-zinc-300 hover:bg-white/10" : "text-zinc-300 hover:bg-white/10"
            }`}
          >
            Sign in
          </Link>
          <a
            href="#contact"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            Request Demo
          </a>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition lg:hidden ${
            transparent ? "text-zinc-300 hover:bg-white/10" : "text-zinc-300 hover:bg-white/10"
          }`}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? (
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          )}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-zinc-950 px-4 pb-5 pt-2 lg:hidden">
          <div className="grid gap-1">
            {NAV.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-white/15 px-4 py-2.5 text-center text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
            >
              Sign in
            </Link>
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Request Demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
