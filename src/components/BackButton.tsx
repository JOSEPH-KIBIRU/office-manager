"use client";

import { useRouter, usePathname } from "next/navigation";

/** Pages where a back button makes no sense (top-level tabs). */
const ROOT_PATHS = ["/dashboard", "/admin"];

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (ROOT_PATHS.includes(pathname)) return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 print:hidden"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
}
