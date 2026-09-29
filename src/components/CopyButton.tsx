"use client";

import { useState } from "react";

interface CopyButtonProps {
  value: string;
  className?: string;
  label?: string;
  copiedLabel?: string;
}

/** Copy-to-clipboard button with inline confirmation. */
export default function CopyButton({
  value,
  className = "btn-secondary",
  label = "Copy",
  copiedLabel = "Copied",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    setFailed(false);
    try {
      if (!navigator.clipboard) throw new Error("unsupported");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 2000);
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? `✓ ${copiedLabel}` : failed ? "Press Ctrl+C" : label}
    </button>
  );
}
