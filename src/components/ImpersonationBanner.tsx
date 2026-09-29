"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "@/components/Spinner";

export default function ImpersonationBanner({ companyName }: { companyName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function exit() {
    setBusy(true);
    try {
      await fetch("/api/admin/impersonate", { method: "DELETE" });
      router.replace("/admin");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 bg-orange-600 px-4 py-2 text-sm text-white">
      <span className="flex-1">
        <strong>Viewing as admin of {companyName}</strong>
        <span className="ml-2 text-orange-100">— you can perform admin actions and inspect company data.</span>
      </span>
      <button
        onClick={exit}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-50 disabled:opacity-50"
      >
        {busy ? (<><Spinner className="h-3.5 w-3.5" /> Exiting…</>) : "Exit this view"}
      </button>
    </div>
  );
}
