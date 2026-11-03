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
      <button className="btn-secondary" onClick={() => router.refresh()} disabled={busy}>
        Check again
      </button>
      <button className="btn-primary" onClick={signOut} disabled={busy}>
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </>
  );
}
