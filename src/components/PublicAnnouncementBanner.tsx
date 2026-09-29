"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

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

const DEFAULT_COLOR = "#2563eb";

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
 * Full-width strip flush with the top of the page, so the announcement reads
 * as part of the navbar rather than a floating card hovering above it.
 */
function AnimatedBanner({ children }: { children: ReactNode }) {
  return <div className="relative z-40 w-full">{children}</div>;
}

/** Slow left-to-right crawl of the message only — the bar itself stays still. */
function Marquee({ children }: { children: ReactNode }) {
  const group = (hidden: boolean) => (
    <div className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={hidden || undefined}>
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="whitespace-nowrap">
          {children}
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative w-full overflow-hidden">
      <div className="marquee-right flex w-max" style={{ "--marquee-duration": "95s" } as CSSProperties}>
        {group(false)}
        {group(true)}
      </div>
    </div>
  );
}

export default function PublicAnnouncementBanner() {
  const [anns, setAnns] = useState<Ann[]>([]);

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

  if (anns.length === 0) {
    return (
      <AnimatedBanner>
        <div
          className="flex w-full items-center justify-center gap-3 px-4 py-2 text-center text-sm font-semibold text-white"
          style={{ background: gradientFor(DEFAULT_COLOR) }}
        >
          <span className="flex-none text-base leading-none">✨</span>
          <div className="min-w-0 flex-1">
            <Marquee>New: AI meeting minutes — recap faster</Marquee>
          </div>
        </div>
      </AnimatedBanner>
    );
  }

  return (
    <AnimatedBanner>
      <div className="w-full">
        {anns.map((a) => {
          const color = /^#[0-9a-fA-F]{6}$/.test(a.color || "") ? (a.color as string) : DEFAULT_COLOR;
          return (
            <div
              key={a.id}
              className={`flex w-full items-center gap-3 px-4 py-2 text-sm font-semibold ${textForHex(color)}`}
              style={{ background: gradientFor(color) }}
            >
              <span className="flex-none text-base leading-none">{TYPE_ICON[a.type] || "🔔"}</span>
              <div className="min-w-0 flex-1">
                <Marquee>
                  {a.link ? (
                    <a href={a.link} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                      {a.message}
                    </a>
                  ) : (
                    a.message
                  )}
                </Marquee>
              </div>
            </div>
          );
        })}
      </div>
    </AnimatedBanner>
  );
}
