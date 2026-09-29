"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface WaLine {
  label: string;
  phone: string; // display format e.g. "0798 118 515"
  wa: string; // wa.me suffix e.g. "254798118515"
}

const LINES: WaLine[] = [
  { label: "General line", phone: "0798 118 515", wa: "254798118515" },
  { label: "Office line", phone: "0708 769 459", wa: "254708769459" },
];

const PUBLIC_PREFIXES = ["/solutions", "/terms", "/privacy", "/cookie-policy", "/login", "/forgot-password", "/change-password", "/accept-terms"];

function WhatsAppIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.59 4.46 1.71 6.4L3.2 28.8l6.57-1.72a12.74 12.74 0 0 0 6.23 1.59h.01c7.06 0 12.79-5.74 12.79-12.8 0-3.42-1.33-6.63-3.75-9.05a12.72 12.72 0 0 0-9.05-3.62Zm0 23.4h-.01a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-3.9 1.02 1.04-3.8-.25-.4a10.6 10.6 0 0 1-1.63-5.65c0-5.87 4.78-10.65 10.66-10.65 2.84 0 5.51 1.11 7.52 3.12a10.57 10.57 0 0 1 3.11 7.53c0 5.87-4.78 10.64-10.65 10.64Zm5.84-7.97c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66 0 1.57 1.14 3.09 1.3 3.3.16.21 2.25 3.44 5.45 4.82.76.33 1.36.53 1.82.68.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

export default function WhatsAppWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isPublic =
    pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!isPublic) setOpen(false);
  }, [pathname, isPublic]);

  if (!isPublic) return null;

  return (
    <div className="no-print fixed bottom-6 left-4 z-50 flex flex-col items-start gap-3 sm:left-6">
      {open && (
        <div className="animate-[fadeup_.25s_ease-out_both] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl shadow-slate-900/20">
          <p className="border-b border-slate-100 bg-emerald-50/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
            Chat with us on WhatsApp
          </p>
          {LINES.map((l) => (
            <a
              key={l.wa}
              href={`https://wa.me/${l.wa}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-slate-700 transition hover:bg-emerald-50"
            >
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[#25D366] text-white">
                <WhatsAppIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{l.phone}</span>
                <span className="block text-xs text-slate-500">{l.label} · WhatsApp</span>
              </span>
            </a>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close WhatsApp chat options" : "Chat with us on WhatsApp"}
        aria-expanded={open}
        className="relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-600/30 transition hover:scale-105 hover:bg-[#1ebe5b]"
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-30" />
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-6 w-6">
            <path d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <WhatsAppIcon className="h-7 w-7" />
        )}
      </button>
    </div>
  );
}
