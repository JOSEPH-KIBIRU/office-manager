"use client";

import { useState } from "react";

interface ShareButtonProps {
  /** The URL to share. Defaults to the current page URL. */
  url?: string;
  title?: string;
  text?: string;
  className?: string;
  label?: string;
}

/**
 * "Share" button using the native Web Share API where available, with a
 * clipboard copy-link fallback. Purely client-side and deliberately free of any
 * context dependency (no toast provider) so it can be used on standalone
 * printable pages (payslip, invoice, bill, requisition) as well as in the app.
 */
export default function ShareButton({
  url,
  title,
  text,
  className = "btn-secondary btn-xs",
  label = "Share",
}: ShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const href = url ?? (typeof window !== "undefined" ? window.location.href : "");

  async function handleShare() {
    setBusy(true);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url: href });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else if (typeof window !== "undefined") {
        window.prompt("Copy this link", href);
      }
    } catch (e) {
      // User cancelled the native share sheet — not an error.
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Fall back to copying the link.
      try {
        await navigator.clipboard.writeText(href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={handleShare} disabled={busy} className={className}>
      {copied ? "✓ Link copied" : busy ? "…" : `🔗 ${label}`}
    </button>
  );
}
