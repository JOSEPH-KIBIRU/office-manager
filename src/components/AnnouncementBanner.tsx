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
  info: "ℹ️",
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

export default function AnnouncementBanner() {
  const [visible, setVisible] = useState<Ann[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/announcements/active");
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        const anns = (data.announcements || []) as Ann[];
        const hidden = new Set<string>(
          JSON.parse(sessionStorage.getItem("om_hidden_ann") || "[]")
        );
        setVisible(anns.filter((a) => !hidden.has(a.id)));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (visible.length === 0) return null;

  function dismiss(id: string) {
    const hidden = JSON.parse(sessionStorage.getItem("om_hidden_ann") || "[]");
    hidden.push(id);
    sessionStorage.setItem("om_hidden_ann", JSON.stringify(hidden));
    setVisible((p) => p.filter((a) => a.id !== id));
  }

  return (
    <div className="w-full">
      {visible.map((a) => {
        const color = /^#[0-9a-fA-F]{6}$/.test(a.color || "") ? (a.color as string) : DEFAULT_COLOR;
        return (
          <div
            key={a.id}
            className={`flex w-full items-center gap-3 px-4 py-1.5 text-sm font-medium ${textForHex(color)}`}
            style={{ background: gradientFor(color) }}
          >
            <span className="text-base leading-none">{TYPE_ICON[a.type] || TYPE_ICON.info}</span>
            <span className="flex-1">
              {a.link ? (
                <a href={a.link} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  {a.message}
                </a>
              ) : (
                a.message
              )}
            </span>
            <button
              onClick={() => dismiss(a.id)}
              aria-label="Dismiss"
              className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-black/15 text-sm leading-none transition hover:bg-black/30"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
