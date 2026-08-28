"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FieldError, inputCls } from "@/components/ui";
import { validate, required, minLen, type Errors } from "@/lib/validation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      alert("Password changed successfully. Welcome!");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">Set a New Password</h1>
          <p className="mt-1 text-sm text-slate-500">
            For security you must change the temporary password before continuing.
          </p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="label">Current password</label>
            <input type="password" className={inputCls(errors.currentPassword)} value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); clearError("currentPassword"); }} required autoFocus />
            <FieldError msg={errors.currentPassword} />
          </div>
          <div>
            <label className="label">New password (min 8 characters)</label>
            <input type="password" className={inputCls(errors.newPassword)} value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); clearError("newPassword"); }} minLength={8} required />
            <FieldError msg={errors.newPassword} />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" className={inputCls(errors.confirm)} value={confirm}
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
          <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
      </div>
    </main>
  );
}
