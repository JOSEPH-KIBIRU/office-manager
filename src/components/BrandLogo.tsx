import Link from "next/link";

/**
 * Office Manager brand lockup: a rotating OFFICE mark + wordmark with the
 * "by PigieCore" sub-label. `dark` is for use on dark backgrounds (white text).
 */
export default function BrandLogo({ dark = false, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5" aria-label="Office Manager">
      {/* Mark — matches the favicon: complete ring with an orbiting accent dot */}
      <svg
        viewBox="0 0 128 128"
        className="h-9 w-9 transition-transform duration-500 group-hover:rotate-12"
        aria-hidden="true"
      >
        <defs>
          <style>{`.om-orbit{animation:om-spin 3s linear infinite;transform-origin:64px 64px}@keyframes om-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          <linearGradient id="om-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r="56" fill="none" stroke="url(#om-ring)" strokeWidth="6" />
        <g className="om-orbit">
          <circle cx="64" cy="8" r="7" fill="#22c55e" stroke="#ffffff" strokeWidth="3" />
        </g>
        <circle cx="64" cy="64" r="42" fill="#4f46e5" />
        <text x="64" y="66" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontFamily="system-ui, -apple-system, sans-serif" fontSize="21" fontWeight="700" letterSpacing="1">OM</text>
      </svg>
      <span className="flex flex-col leading-none">
        <span className={`text-base font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
          Office Manager
        </span>
        <span className={`text-[10px] font-medium tracking-wide ${dark ? "text-slate-400" : "text-slate-500"}`}>
          by PigieCore
        </span>
      </span>
    </Link>
  );
}
