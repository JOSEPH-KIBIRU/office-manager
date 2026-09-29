"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Spinner from "@/components/Spinner";

export default function AcceptTermsPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAgree() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/terms", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save your agreement");
      }
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your agreement");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-100 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-2xl font-bold text-white">
            OM
          </div>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Step 2 of 2 · Almost done
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Agree to our Terms &amp; Conditions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Please review and agree to continue using Office Manager. This is only asked once.
          </p>
        </div>

        <div className="card space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              By continuing, you agree to our{" "}
              <Link href="/terms" className="font-medium text-blue-600 underline hover:text-blue-700">
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-blue-600 underline hover:text-blue-700">
                Privacy Policy
              </Link>
              . This includes using the Service only for legitimate business purposes and safeguarding your account
              credentials.
            </p>
            <p>
              You can read the full documents at any time using the links above. If you do not agree, you should not
              continue using the Service.
            </p>
          </div>

          <button className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5" onClick={handleAgree} disabled={busy}>
            {busy ? (<><Spinner className="h-4 w-4" /> Saving…</>) : "I Agree"}
          </button>
          <p className="text-center text-xs text-slate-400">
            If you do not agree, please{" "}
            <Link href="/login" className="text-blue-600 underline hover:text-blue-700">
              sign out
            </Link>{" "}
            and do not continue.
          </p>
        </div>
      </div>
    </main>
  );
}