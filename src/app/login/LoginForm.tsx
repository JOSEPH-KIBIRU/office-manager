"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Spinner from "@/components/Spinner";

interface LoginResult {
  role?: string;
  mustChangePassword?: boolean;
  termsAgreedAt?: boolean;
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("expired")) {
      setNotice("Your session timed out due to inactivity. Please sign in again.");
    } else if (params.has("reset")) {
      setNotice("Your password has been reset. Please sign in with your new password.");
    }
  }, []);

  function finishLogin(data: LoginResult) {
    try {
      localStorage.removeItem("om_last_active");
    } catch {
      /* ignore */
    }
    router.replace(
      data.mustChangePassword ? "/change-password" : data.termsAgreedAt ? "/dashboard" : "/accept-terms"
    );
    router.refresh();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const wait =
          typeof data.retryAfterSeconds === "number"
            ? ` Please try again in about ${data.retryAfterSeconds}s.`
            : "";
        throw new Error((data.error || "Login failed") + wait);
      }
      if (data.twoFactorRequired) {
        setChallenge(String(data.challenge));
        setBusy(false);
        return;
      }
      finishLogin(data);
    } catch (err) {
      const msg =
        err instanceof Error && /fetch|network|load failed/i.test(err.message)
          ? "Couldn't reach the server. Check your connection and try again."
          : err instanceof Error
          ? err.message
          : "Login failed";
      setError(msg);
      setBusy(false);
    }
  }

  async function verifyTwoFactor(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Verification failed");
      finishLogin(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-blue-700">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            Back to home
          </Link>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-2xl font-bold text-white">
            OM
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Office Manager</h1>
          <p className="mt-1 text-sm text-slate-500">
            {challenge ? "Enter your two-factor code" : "Sign in to your office account"}
          </p>
        </div>

        {challenge ? (
          <form onSubmit={verifyTwoFactor} className="card p-6 space-y-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <p className="text-sm text-slate-600">
              Open your authenticator app and enter the 6-digit code{useRecovery ? " — or a recovery code" : ""}.
            </p>
            <input
              className="input text-center text-lg tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={useRecovery ? "Recovery code" : "000000"}
              autoFocus
              required
            />
            <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5" disabled={busy}>
              {busy ? (<><Spinner className="h-4 w-4" /> Verifying…</>) : "Verify & sign in"}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setUseRecovery((v) => !v); setCode(""); }} className="font-medium text-blue-700 hover:underline">
                {useRecovery ? "Use authenticator code" : "Use a recovery code"}
              </button>
              <button type="button" onClick={() => { setChallenge(null); setCode(""); setError(null); }} className="text-slate-500 hover:underline">
                Back
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submit} className="card p-6 space-y-4">
            {notice && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="input pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                  )}
                </button>
              </div>
              <div className="mt-1.5 text-right">
                <Link href="/forgot-password" className="text-xs font-medium text-blue-700 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>
            <p className="text-center text-xs text-slate-500">
              By signing in, you agree to our{" "}
              <Link href="/terms" className="font-medium text-blue-700 underline hover:text-blue-900">Terms &amp; Conditions</Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-blue-700 underline hover:text-blue-900">Privacy Policy</Link>.
            </p>
            <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5" disabled={busy}>
              {busy ? (<><Spinner className="h-4 w-4" /> Signing in…</>) : "Sign in"}
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-xs text-slate-400">
          New accounts are created by the admin. Logins are sent via email and SMS.
        </p>
      </div>
    </main>
  );
}
