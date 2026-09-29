"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FieldError, inputCls } from "@/components/ui";
import Spinner from "@/components/Spinner";
import { validate, required, minLen, type Errors } from "@/lib/validation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs = validate({ currentPassword, newPassword, confirm }, {
      currentPassword: [required("Current password")],
      newPassword: [required("New password"), minLen(8, "New password")],
      confirm: [required("Password confirmation")],
    });
    if (!errs.confirm && !errs.newPassword && newPassword !== confirm) {
      errs.confirm = "New passwords do not match";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      setError(null);
      setSuccess("Password changed successfully.");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error && /fetch|network|load failed/i.test(err.message)
          ? "Couldn't reach the server. Check your connection and try again."
          : err instanceof Error
          ? err.message
          : "Failed to change password";
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Step 1 of 2 · Secure your account
          </span>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Set a New Password</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your admin created a temporary password. Choose a new one to continue — you&apos;ll confirm
            the terms next.
          </p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
          )}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
            Show passwords
          </label>
          <div>
            <label className="label">Current password</label>
            <input type={show ? "text" : "password"} className={inputCls(errors.currentPassword)} value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); clearError("currentPassword"); }} required autoFocus />
            <FieldError msg={errors.currentPassword} />
          </div>
          <div>
            <label className="label">New password (min 8 characters)</label>
            <input type={show ? "text" : "password"} className={inputCls(errors.newPassword)} value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); clearError("newPassword"); }} minLength={8} required />
            <FieldError msg={errors.newPassword} />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type={show ? "text" : "password"} className={inputCls(errors.confirm)} value={confirm}
              onChange={(e) => { setConfirm(e.target.value); clearError("confirm"); }} minLength={8} required />
            <FieldError msg={errors.confirm} />
          </div>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              router.replace("/login");
            }}
          >
            Cancel / Sign out
          </button>
          <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5" disabled={busy}>
            {busy ? (<><Spinner className="h-4 w-4" /> Saving…</>) : "Save new password"}
          </button>
        </form>
      </div>
    </main>
  );
}
