"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Alert, FieldError, inputCls } from "@/components/ui";
import Spinner from "@/components/Spinner";
import TurnstileWidget from "@/components/TurnstileWidget";

/**
 * Low-friction demo request: only a phone number is required. We fill the
 * enquiry with sensible defaults so the sales team can call the person back
 * without asking them to write a message first.
 */
export default function ContactForm({ initialSolution }: { initialSolution?: string }) {
  const [phone, setPhone] = useState("");
  const [solution, setSolution] = useState(initialSolution ?? "");
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  useEffect(() => {
    if (initialSolution) return;
    try {
      const fromQuery = new URLSearchParams(window.location.search).get("solution");
      if (fromQuery) setSolution(fromQuery);
    } catch {
      /* ignore */
    }
  }, [initialSolution]);

  function validate(): boolean {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 13) {
      setPhoneError("Please enter a valid phone number");
      return false;
    }
    setPhoneError(undefined);
    return true;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    if (captchaRequired && !captchaToken) {
      setError("Please complete the verification below.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name: "Website demo request",
          email: "",
          company: "",
          subject: solution ? `Demo request — ${solution}` : "Demo request",
          message: solution
            ? `Requested a demo callback for ${solution}.`
            : "Requested a demo callback from the website.",
          turnstileToken: captchaToken ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setCaptchaToken(null);
      setCaptchaReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-7 w-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-4 text-xl font-bold text-white">Thanks — we&apos;ll call you back</h3>
        <p className="mt-2 text-sm text-zinc-300">
          We&apos;ve received <strong className="text-white">{phone}</strong>. Our team will call you
          within one business hour.
        </p>
        <a href="tel:+254798118515" className="mt-5 inline-block text-sm font-semibold text-emerald-300 hover:text-emerald-200">
          Prefer to talk now? Call 0798 118 515
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-white">Request a callback</h3>
        <p className="mt-1 text-sm text-zinc-300">
          Just your phone number. No long forms, no obligation — we&apos;ll call you back.
        </p>
      </div>

      <div>
        <label htmlFor="demo-phone" className="mb-1 block text-sm font-medium text-zinc-200">
          Phone number *
        </label>
        <input
          id="demo-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (phoneError) setPhoneError(undefined);
          }}
          className={inputCls(phoneError)}
          placeholder="07XX XXX XXX"
          aria-describedby="demo-phone-help"
          aria-invalid={Boolean(phoneError)}
          required
        />
        <FieldError msg={phoneError} />
        <p id="demo-phone-help" className="mt-2 text-xs text-zinc-400">
          We only use this number to call you about your demo.
        </p>
      </div>

      <TurnstileWidget
        onToken={setCaptchaToken}
        theme="dark"
        resetKey={captchaReset}
        className="min-h-[65px]"
      />

      {error && <Alert kind="error">{error}</Alert>}

      <button type="submit" disabled={busy} className="btn-grad w-full py-3">
        {busy ? (
          <>
            <Spinner className="h-4 w-4" /> Sending…
          </>
        ) : (
          "Request a callback"
        )}
      </button>

      <p className="text-xs leading-relaxed text-zinc-400">
        By submitting, you agree to be contacted about Office Manager. See our{" "}
        <Link href="/privacy" className="font-semibold text-indigo-300 hover:text-indigo-200">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
