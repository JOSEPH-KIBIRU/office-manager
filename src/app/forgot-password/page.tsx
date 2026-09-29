"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FieldError, inputCls } from "@/components/ui";
import Spinner from "@/components/Spinner";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; code?: string; newPassword?: string; confirm?: string }>({});

  function clear(field: keyof typeof errors) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) {
      setErrors({ email: "Enter a valid email address" });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the code");
      setStep(2);
      setNotice("If your account has a phone number on file, we've sent a 6-digit code by SMS.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: typeof errors = {};
    if (!/^\d{6}$/.test(code.trim())) errs.code = "Enter the 6-digit code from the SMS";
    if (newPassword.length < 8) errs.newPassword = "Use at least 8 characters";
    if (newPassword !== confirm) errs.confirm = "Passwords do not match";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not reset the password");
      router.replace("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/login" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-blue-700">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            Back to sign in
          </Link>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-2xl font-bold text-white">OM</div>
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === 1
              ? "Enter your email and we'll text a 6-digit code to your registered phone."
              : "Enter the code we texted you and choose a new password."}
          </p>
        </div>

        <div className="card space-y-4 p-6">
          {notice && <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</div>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {step === 1 ? (
            <form onSubmit={requestCode} className="space-y-4">
              <div>
                <label className="label" htmlFor="fp-email">Email address</label>
                <input
                  id="fp-email"
                  type="email"
                  className={inputCls(errors.email)}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clear("email"); }}
                  placeholder="you@company.com"
                  required
                  autoFocus
                />
                <FieldError msg={errors.email} />
              </div>
              <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5" disabled={busy}>
                {busy ? (<><Spinner className="h-4 w-4" /> Sending…</>) : "Send reset code"}
              </button>
              <p className="text-center text-xs text-slate-500">
                The code is sent by <strong>SMS only</strong>. If no phone number is on file, ask your admin.
              </p>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="space-y-4">
              <div>
                <label className="label" htmlFor="fp-code">6-digit code</label>
                <input
                  id="fp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className={`${inputCls(errors.code)} tracking-[0.4em]`}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); clear("code"); }}
                  placeholder="000000"
                  required
                  autoFocus
                />
                <FieldError msg={errors.code} />
              </div>
              <div>
                <label className="label" htmlFor="fp-new">New password (min 8 characters)</label>
                <input
                  id="fp-new"
                  type={show ? "text" : "password"}
                  className={inputCls(errors.newPassword)}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); clear("newPassword"); }}
                  minLength={8}
                  required
                />
                <FieldError msg={errors.newPassword} />
              </div>
              <div>
                <label className="label" htmlFor="fp-confirm">Confirm new password</label>
                <input
                  id="fp-confirm"
                  type={show ? "text" : "password"}
                  className={inputCls(errors.confirm)}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); clear("confirm"); }}
                  minLength={8}
                  required
                />
                <FieldError msg={errors.confirm} />
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-blue-700" />
                Show passwords
              </label>
              <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5" disabled={busy}>
                {busy ? (<><Spinner className="h-4 w-4" /> Resetting…</>) : "Reset password"}
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setError(null); setNotice(null); }}
                className="btn-secondary w-full"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
