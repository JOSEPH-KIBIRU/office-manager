"use client";

import type { CSSProperties } from "react";

// Sidebar functions shown as glowing nodes on the orbits.
const NODES = [
  { label: "Payroll", icon: "💰", ring: 0, angle: 20, tone: "from-indigo-400 to-violet-500" },
  { label: "Invoicing", icon: "🧾", ring: 0, angle: 140, tone: "from-sky-400 to-blue-500" },
  { label: "Accounting", icon: "📒", ring: 0, angle: 260, tone: "from-cyan-400 to-teal-500" },
  { label: "Leave", icon: "🌴", ring: 1, angle: 80, tone: "from-emerald-400 to-green-500" },
  { label: "Petty Cash", icon: "💵", ring: 1, angle: 200, tone: "from-amber-300 to-orange-500" },
  { label: "Meetings", icon: "📅", ring: 1, angle: 320, tone: "from-fuchsia-400 to-purple-500" },
  { label: "Tasks", icon: "✅", ring: 2, angle: 0, tone: "from-lime-400 to-emerald-500" },
  { label: "Assets", icon: "📦", ring: 2, angle: 180, tone: "from-rose-400 to-pink-500" },
];

const RINGS = [
  { size: 82, dur: 52, sheen: 16, reverse: false },
  { size: 62, dur: 38, sheen: 13, reverse: true },
  { size: 48, dur: 28, sheen: 10, reverse: false },
];

function spinClass(reverse: boolean) {
  return reverse ? "orbit-spin-reverse" : "orbit-spin";
}

const RING_MASK = "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))";

export default function GlowOrbits() {
  return (
    <div aria-hidden="true" className="pointer-events-none relative mx-auto aspect-square w-full max-w-[34rem]">
      {/* Ambient glow behind the whole system */}
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.30),transparent_62%)] blur-2xl" />
      <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_62%_38%,rgba(37,99,235,0.26),transparent_60%)] blur-2xl" />

      {/* Rings + orbiting particles (behind the nodes) */}
      <div className="absolute inset-0 z-0">
        {RINGS.map((ring, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: `${ring.size}%`, height: `${ring.size}%` }}
          >
            {/* Bright blue glowing ring */}
            <div
              className="absolute inset-0 rounded-full border border-sky-400/40"
              style={{
                boxShadow:
                  "0 0 26px rgba(56,189,248,0.45), 0 0 70px rgba(37,99,235,0.28), inset 0 0 48px rgba(56,189,248,0.18)",
              }}
            />
            <div className="absolute inset-[3.5%] rounded-full border border-sky-300/15" />

            {/* Travelling light arc */}
            <div
              className={`absolute inset-0 rounded-full ${spinClass(ring.reverse)}`}
              style={
                {
                  "--orbit-duration": `${ring.sheen}s`,
                  background:
                    "conic-gradient(from 0deg, rgba(56,189,248,0) 0deg, rgba(56,189,248,0) 300deg, rgba(56,189,248,0.85) 345deg, rgba(224,242,254,0.95) 358deg, rgba(56,189,248,0) 360deg)",
                  WebkitMaskImage: RING_MASK,
                  maskImage: RING_MASK,
                } as CSSProperties
              }
            />

            {/* Orbiting glowing particles */}
            <div className={`absolute inset-0 ${spinClass(ring.reverse)}`} style={{ "--orbit-duration": `${ring.dur}s` } as CSSProperties}>
              <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200 shadow-[0_0_14px_rgba(56,189,248,1),0_0_32px_rgba(56,189,248,0.65)]" />
            </div>
            <div className={`absolute inset-0 ${spinClass(!ring.reverse)}`} style={{ "--orbit-duration": `${ring.dur + 7}s` } as CSSProperties}>
              <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-300 shadow-[0_0_12px_rgba(96,165,250,0.95),0_0_26px_rgba(96,165,250,0.55)]" />
            </div>
          </div>
        ))}
      </div>

      {/* Center core — official logo mark */}
      <div className="absolute left-1/2 top-1/2 z-10 w-[24%] -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.48),transparent_70%)] blur-2xl" />
          <div className="relative grid aspect-square place-items-center rounded-full border border-sky-300/20 bg-zinc-900/85 shadow-[0_0_60px_-10px_rgba(56,189,248,0.85)] backdrop-blur-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/office-manager-mark.svg" alt="Office Manager" className="h-[62%] w-[62%]" />
          </div>
        </div>
      </div>

      {/* Labeled nodes — on top so they are always visible; each drifts in/out */}
      <div className="absolute inset-0 z-20">
        {NODES.map((n, idx) => {
          const ring = RINGS[n.ring];
          const dur = (n.ring === 0 ? 9.5 : n.ring === 1 ? 8 : 7).toFixed(1);
          return (
            <div
              key={n.label}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: `${ring.size}%`, height: `${ring.size}%` }}
            >
              <div className="absolute inset-0" style={{ transform: `rotate(${n.angle}deg)` }}>
                <div
                  className="node-float absolute inset-0"
                  style={{ "--node-dur": `${dur}s`, animationDelay: `${-(idx * 0.8)}s` } as CSSProperties}
                >
                  <div
                    className="absolute left-1/2 top-0"
                    style={{ transform: `translate(-50%, -50%) rotate(${-n.angle}deg)` }}
                  >
                    <div className="flex flex-col items-center gap-1 sm:gap-1.5">
                      <span className="relative grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-zinc-900/85 text-[13px] shadow-lg backdrop-blur sm:h-9 sm:w-9 sm:text-[15px]">
                        <span className={`halo-pulse absolute -inset-1 rounded-full bg-gradient-to-br ${n.tone} blur-md`} />
                        <span className={`absolute inset-0 rounded-full bg-gradient-to-br ${n.tone} opacity-25`} />
                        <span className="relative">{n.icon}</span>
                      </span>
                      <span className="whitespace-nowrap rounded-full border border-white/10 bg-zinc-900/80 px-2 py-0.5 text-[9px] font-semibold text-zinc-200 shadow-sm backdrop-blur sm:px-2.5 sm:text-[10px]">
                        {n.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
