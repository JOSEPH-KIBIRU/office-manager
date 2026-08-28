"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";

interface Slide {
  src: string;
  alt: string;
}

const INTERVAL = 4000;

export default function HeroVisual({ slides }: { slides: Slide[] }) {
  const [active, setActive] = useState(0);

  const next = useCallback(() => setActive((a) => (a + 1) % slides.length), [slides.length]);

  useEffect(() => {
    const t = setInterval(next, INTERVAL);
    return () => clearInterval(t);
  }, [next]);

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-roledescription="carousel">
      {/* Image stage — edges dissolve into the dark background (no hard box) */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-[2rem]">
        <div className="absolute inset-0 rounded-t-[2rem] bg-gradient-to-b from-slate-800/50 to-slate-950/70" />
        {slides.map((s, i) => (
          <div
            key={s.src}
            className={`absolute inset-0 transition-opacity duration-1000 ${i === active ? "opacity-100" : "opacity-0"}`}
            aria-hidden={i !== active}
          >
            <Image
              src={s.src}
              alt={s.alt}
              fill
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-cover"
              priority={i === 0}
            />
            {/* duotone tint — unifies photo with the dark theme */}
            <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply" />
            {/* bottom fade — dissolves the image into the hero canvas */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          </div>
        ))}
      </div>

      {/* dots — integrated, dark */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.src}
            onClick={() => setActive(i)}
            aria-label={`Show slide ${i + 1}: ${s.alt}`}
            className={`h-2.5 rounded-full transition-all ${i === active ? "w-7 bg-blue-400" : "w-2.5 bg-white/25 hover:bg-white/40"}`}
          />
        ))}
      </div>

      {/* floating notification card — dark glass */}
      <div className="absolute -left-3 bottom-10 hidden rounded-xl border border-white/10 bg-slate-900/80 p-3 shadow-2xl backdrop-blur sm:flex sm:items-center sm:gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" /></svg>
        </span>
        <div className="text-left">
          <p className="text-xs font-semibold text-white">Leave approved</p>
          <p className="text-[11px] text-slate-400">Annual · 3 days · SMS sent</p>
        </div>
      </div>

      {/* floating payroll card — dark glass */}
      <div className="absolute -right-3 -top-6 hidden rounded-xl border border-white/10 bg-slate-900/80 p-3 shadow-2xl backdrop-blur sm:block">
        <p className="text-[11px] text-slate-400">Payroll processed</p>
        <p className="text-base font-extrabold text-emerald-300">KES 1,420,000</p>
        <p className="mt-1 inline-block rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">PAYE · NSSF · SHIF ✓</p>
      </div>
    </div>
  );
}
