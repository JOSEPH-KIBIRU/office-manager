"use client";

import { useState, type CSSProperties } from "react";

const ORBITS = [
  { size: "100%", duration: "46s", reverse: false, offset: 200, chips: ["Payroll", "Leave"] },
  { size: "78%", duration: "34s", reverse: true, offset: 40, chips: ["Petty Cash", "Invoices"] },
  { size: "56%", duration: "26s", reverse: false, offset: 300, chips: ["Meetings", "Vehicles"] },
];

function Chip({ label }: { label: string }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white/95 px-3 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm backdrop-blur">
      {label}
    </span>
  );
}

export default function OrbitVisual() {
  const [imgOk, setImgOk] = useState(true);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(99,102,241,0.22),transparent_65%)] blur-2xl" />

      {/* orbit rings */}
      {ORBITS.map((orbit) => (
        <div
          key={orbit.size}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: orbit.size, height: orbit.size }}
        >
          <div className="h-full w-full rounded-full border border-dashed border-indigo-200/80" />

          {/* orbiting dot */}
          <div
            className={`absolute inset-0 ${orbit.reverse ? "orbit-spin-reverse" : "orbit-spin"}`}
            style={{ "--orbit-duration": orbit.duration } as CSSProperties}
          >
            <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.15)]" />
          </div>

          {/* chips pinned to the ring */}
          {orbit.chips.map((chip, i) => {
            const angle = (360 / orbit.chips.length) * i + orbit.offset;
            return (
              <div key={chip} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
                <div
                  className="absolute left-1/2 top-0"
                  style={{ transform: `translate(-50%, -50%) rotate(${-angle}deg)` }}
                >
                  <Chip label={chip} />
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* center: real screenshot */}
      <div className="absolute left-1/2 top-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_24px_70px_-20px_rgba(15,23,42,0.45)] ring-1 ring-zinc-900/5">
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-50">
            {imgOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/images/dashboard-preview.png"
                alt="Office Manager dashboard preview"
                className="h-full w-full object-cover object-top"
                onError={() => setImgOk(false)}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white">
                  OM
                </span>
                <span className="text-[10px] font-semibold text-zinc-500">Office Manager</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
