"use client";

import { useEffect, useState } from "react";

interface Ann {
  id: string;
  message: string;
  type: string;
  link: string | null;
  color: string | null;
}

const TYPE_ICON: Record<string, string> = {
  info: "🔔",
  maintenance: "🛠️",
  training: "🎓",
  offer: "🎁",
  outage: "⚠️",
};

const DEFAULT_COLOR = "#4f46e5";
const DISMISS_KEY = "om_announcement_dismissed";

const DEFAULT_ANN: Ann = {
  id: "default",
  message: "New: AI meeting minutes — recap faster",
  type: "info",
  link: "#product-tour",
  color: DEFAULT_COLOR,
};

function textForHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? "text-slate-900" : "text-white";
}

function shade(hex: string, percent: number): string {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function gradientFor(hex: string): string {
  const base = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_COLOR;
  const c = base.toLowerCase();
  return `linear-gradient(90deg, ${shade(c, -18)} 0%, ${c} 50%, ${shade(c, 14)} 100%)`;
}

/**
 * Single-line, dismissible announcement strip. It intentionally avoids the
 * old duplicated marquee: one accessible copy, a close button and a clear link.
 */
export default function PublicAnnouncementBanner() {
  const [anns, setAnns] = useState<Ann[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) setDismissed(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/public/announcements");
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setAnns((data.announcements || []) as Ann[]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const active = anns[0] ?? DEFAULT_ANN;
  if (dismissed.includes(active.id)) return null;

  const color = /^#[0-9a-fA-F]{6}$/.test(active.color || "") ? (active.color as string) : DEFAULT_COLOR;
  const external = Boolean(active.link && /^https?:\/\//i.test(active.link));

  function dismiss() {
    setDismissed((prev) => {
      const next = Array.from(new Set([...prev, active.id]));
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold sm:px-4 sm:text-sm ${textForHex(color)}`}
      style={{ background: gradientFor(color) }}
    >
      <span aria-hidden="true" className="flex-none text-base leading-none">
        {TYPE_ICON[active.type] || "🔔"}
      </span>
      <div className="min-w-0 flex-1 text-center">
        {active.link ? (
          <a
            href={active.link}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            title={active.message}
            className="block truncate underline-offset-2 hover:underline"
          >
            {active.message}
          </a>
        ) : (
          <span title={active.message} className="block truncate">
            {active.message}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="flex-none rounded p-1 opacity-80 transition hover:bg-black/10 hover:opacity-100"
      >
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="h-4 w-4" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
