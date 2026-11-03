"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/ui";

export default function SubscriptionRequiredActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth", { method: "DELETE" });
    } catch {
      /* clear the cookie best-effort */
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <>
      <button
        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
        onClick={() => router.refresh()}
        disabled={busy}
      >
        Check again
      </button>
      <button
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:opacity-60"
        onClick={signOut}
        disabled={busy}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </>
  );
}
