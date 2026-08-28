"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Alert, FieldError, inputCls, api } from "@/components/ui";
import { validate, required, email as emailRule, phone as phoneRule, type Errors } from "@/lib/validation";
import type { ProfileChangeRequestRow } from "@/lib/types";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  leave_balance: number;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = { name: "Name", email: "Email" };

export default function ProfilePage() {
  const session = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<ProfileChangeRequestRow[]>([]);
  const [phone, setPhone] = useState("");
  const [field, setField] = useState<"name" | "email">("name");
  const [requestedValue, setRequestedValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function load() {
    try {
      const [p, r] = await Promise.all([
        api<{ profile: Profile }>("/api/profile"),
        api<{ requests: ProfileChangeRequestRow[] }>("/api/profile/requests"),
      ]);
      setProfile(p.profile);
      setPhone(p.profile.phone ?? "");
      setRequests(r.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function savePhone(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const errs = validate({ phone }, { phone: [phoneRule("Phone number")] });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    setErrors({});
    try {
      await api("/api/profile", { method: "PATCH", json: { phone } });
      setNotice("Phone number updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update phone");
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const errs = validate({ requestedValue }, {
      requestedValue: [
        required(field === "email" ? "New email" : "New name"),
        ...(field === "email" ? [emailRule("New email")] : []),
      ],
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    setErrors({});
    try {
      await api("/api/profile/requests", { method: "POST", json: { field, requested_value: requestedValue } });
      setRequestedValue("");
      setNotice("Change request sent to the admin for approval.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="My Profile" subtitle="Update your phone number or ask the admin to change your details." />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">My details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Name</dt><dd className="font-medium">{profile?.name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Email</dt><dd className="font-medium">{profile?.email}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Role</dt><dd className="font-medium capitalize">{session.role}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Leave balance</dt><dd className="font-medium">{profile?.leave_balance} days</dd></div>
          </dl>

          <hr className="border-slate-100" />

          <form onSubmit={savePhone} className="space-y-2">
            <label className="label">Phone number (SMS notifications)</label>
            <div className="flex gap-2">
              <input className={`${inputCls(errors.phone)} flex-1`} value={phone}
                onChange={(e) => { setPhone(e.target.value); clearError("phone"); }} placeholder="+2547…" />
              <button type="submit" className="btn-primary whitespace-nowrap" disabled={busy}>Save phone</button>
            </div>
            <FieldError msg={errors.phone} />
            <p className="text-xs text-slate-500">You can change this yourself — it takes effect immediately.</p>
          </form>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Request a detail change</h2>
          <p className="text-sm text-slate-500">Name and email changes must be approved by the admin.</p>
          <form onSubmit={submitRequest} className="space-y-3">
            <div>
              <label className="label">What should change?</label>
              <select className="input" value={field} onChange={(e) => setField(e.target.value as "name" | "email")}>
                <option value="name">Name</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label className="label">Requested new value</label>
              <input
                className={inputCls(errors.requestedValue)}
                type={field === "email" ? "email" : "text"}
                value={requestedValue}
                onChange={(e) => { setRequestedValue(e.target.value); clearError("requestedValue"); }}
                placeholder={field === "email" ? "new.name@company.com" : "Your correct full name"}
                required
              />
              <FieldError msg={errors.requestedValue} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              Send request to admin
            </button>
          </form>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-semibold">My change requests</h2>
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Field</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">No change requests yet.</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{FIELD_LABELS[r.field]}</td>
                  <td>{r.current_value ?? "—"}</td>
                  <td>{r.requested_value}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
