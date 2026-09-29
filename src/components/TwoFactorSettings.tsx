"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, api, inputCls } from "@/components/ui";
import Spinner from "@/components/Spinner";
import CopyButton from "@/components/CopyButton";

type Status = { enabled: boolean; recovery_count: number };

type Setup = { secret: string; otpauthUrl: string; qr: string };

export default function TwoFactorSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await api<Status>("/api/auth/2fa/status"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load two-factor status");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function startSetup() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setSetup(await api<Setup>("/api/auth/2fa/setup", { method: "POST" }));
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start setup");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ recoveryCodes: string[] }>("/api/auth/2fa/enable", {
        method: "POST",
        json: { code },
      });
      setRecoveryCodes(res.recoveryCodes);
      setSetup(null);
      setCode("");
      setNotice("Two-factor authentication is on.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable two-factor authentication");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/2fa/disable", { method: "POST", json: { code } });
      setDisabling(false);
      setCode("");
      setNotice("Two-factor authentication is off.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable two-factor authentication");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setSetup(null);
    setDisabling(false);
    setCode("");
    setError(null);
  }

  const enabled = status?.enabled ?? false;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Two-factor authentication</h2>
          <p className="mt-1 text-sm text-slate-500">
            Require a 6-digit code from your authenticator app when signing in.
          </p>
        </div>
        <span
          className={
            enabled
              ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
              : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
          }
        >
          {enabled ? "On" : "Off"}
        </span>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {recoveryCodes && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Save your recovery codes</p>
          <p className="text-xs text-amber-800">
            Each code works once. They are the only way back in if you lose your phone. Copy them now — they
            are not shown again.
          </p>
          <ul className="grid grid-cols-2 gap-1.5 font-mono text-xs text-amber-900">
            {recoveryCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <CopyButton value={recoveryCodes.join("\n")} />
            <button onClick={() => setRecoveryCodes(null)} className="btn-primary text-xs">
              I have saved them
            </button>
          </div>
        </div>
      )}

      {setup && !recoveryCodes && (
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Open Google Authenticator, Microsoft Authenticator or similar.</li>
            <li>Add a new account and scan this QR code.</li>
            <li>Enter the 6-digit code it shows to finish.</li>
          </ol>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="Authenticator QR code" className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs text-slate-500">Can't scan? Enter this key manually:</p>
              <p className="break-all rounded-lg bg-slate-50 px-2 py-1.5 font-mono text-xs">{setup.secret}</p>
              <CopyButton value={setup.secret} />
            </div>
          </div>
          <form onSubmit={confirmSetup} className="space-y-2">
            <label className="label" htmlFor="tfa-enable-code">6-digit code</label>
            <input
              id="tfa-enable-code"
              className={`${inputCls(undefined)} text-center text-lg tracking-[0.4em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              required
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={busy || code.length !== 6}>
                {busy ? (<><Spinner className="h-4 w-4" /> Verifying…</>) : "Turn on 2FA"}
              </button>
              <button type="button" onClick={cancel} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {!setup && !recoveryCodes && enabled && !disabling && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            {status?.recovery_count ?? 0} recovery{" "}
            {(status?.recovery_count ?? 0) === 1 ? "code" : "codes"} left.
          </p>
          <button onClick={() => setDisabling(true)} className="btn-secondary">
            Turn off 2FA
          </button>
        </div>
      )}

      {!setup && !recoveryCodes && enabled && disabling && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            disable();
          }}
          className="space-y-2"
        >
          <p className="text-sm text-slate-600">Enter a current code to turn 2FA off.</p>
          <label className="label" htmlFor="tfa-disable-code">Authenticator or recovery code</label>
          <input
            id="tfa-disable-code"
            className={inputCls(undefined)}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={busy || !code}>
              {busy ? (<><Spinner className="h-4 w-4" /> Turning off…</>) : "Turn off 2FA"}
            </button>
            <button type="button" onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {!setup && !recoveryCodes && !enabled && !disabling && (
        <button onClick={startSetup} className="btn-primary" disabled={busy || !status}>
          {busy ? (<><Spinner className="h-4 w-4" /> Loading…</>) : "Set up 2FA"}
        </button>
      )}
    </section>
  );
}
