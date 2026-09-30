"use client";

import { printDocument } from "@/lib/print";

export default function PrintButton({
  path = "/",
  label = "🖨 Print / Save as PDF",
}: {
  /** Clean, id-free URL to show while printing. */
  path?: string;
  label?: string;
}) {
  return (
    <div className="no-print mx-auto mt-8 mb-4 max-w-3xl px-6">
      <button onClick={() => printDocument(path)} className="btn-primary">{label}</button>
    </div>
  );
}
