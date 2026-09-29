"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

/**
 * Shared, branded fallback for error boundaries. Rendered in place of the page
 * that threw, so the surrounding app shell (sidebar/header) stays intact.
 */
export default function ErrorFallback({
  error,
  reset,
  homeHref = "/dashboard",
  homeLabel = "Back to dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    // Surface the error for diagnostics without leaking it to the UI.
    console.error(error);
    // Report to Sentry (no-op when monitoring is disabled).
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">⚠️</div>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        We couldn&apos;t load this page. This is usually temporary — try again, and if it keeps
        happening please contact support.
      </p>
      {error.digest && <p className="mt-1 text-xs text-slate-400">Reference: {error.digest}</p>}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => reset()} className="btn-primary px-5 py-2.5">
          Try again
        </button>
        <Link href={homeHref} className="btn-secondary px-5 py-2.5">
          {homeLabel}
        </Link>
        <a href="https://wa.me/254798118515" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:underline">
          Contact support
        </a>
      </div>
    </div>
  );
}
