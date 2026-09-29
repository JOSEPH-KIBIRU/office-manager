"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Alert, FieldError, inputCls, api } from "@/components/ui";
import TwoFactorSettings from "@/components/TwoFactorSettings";
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

interface CalendarConnection {
  id: string;
  provider: string;
  email: string | null;
  status: string;
}

interface IntegrationsData {
  connections: CalendarConnection[];
  providers: { id: string; label: string; configured: boolean }[];
}

const FIELD_LABELS: Record<string, string> = { name: "Name", email: "Email" };

export default function ProfilePage() {
  const session = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<ProfileChangeRequestRow[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationsData | null>(null);
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
    try {
      setIntegrations(await api<IntegrationsData>("/api/integrations"));
    } catch {
      /* calendar sync optional */
    }
  }

  useEffect(() => {
    load();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cal = params.get("calendar");
      if (cal === "connected") setNotice("Calendar connected successfully.");
      else if (cal === "error") setError("Could not connect that calendar. Please try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function disconnectCalendar(provider: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/integrations/${provider}/disconnect`, { method: "POST" });
      setNotice("Calendar disconnected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect calendar");
    } finally {
      setBusy(false);
    }
  }

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
            <label className="label" htmlFor="pf-phone">Phone number (SMS notifications)</label>
            <div className="flex gap-2">
              <input id="pf-phone" className={`${inputCls(errors.phone)} flex-1`} value={phone}
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
              <label className="label" htmlFor="pf-field">What should change?</label>
              <select id="pf-field" className="input" value={field} onChange={(e) => setField(e.target.value as "name" | "email")}>
                <option value="name">Name</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pf-value">Requested new value</label>
              <input
                id="pf-value"
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

      <div className="mt-6">
        <TwoFactorSettings />
      </div>

      {integrations && (
        <section className="mt-6 card p-5">
          <h2 className="font-semibold">Calendar sync</h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect your Google or Microsoft calendar and your approved leave and scheduled meetings
            are added automatically.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {integrations.providers.map((p) => {
              const conn = integrations.connections.find((c) => c.provider === p.id);
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{p.label}</p>
                    <p className="truncate text-xs text-slate-500">
                      {conn
                        ? `Connected${conn.email ? ` · ${conn.email}` : ""}`
                        : p.configured
                        ? "Not connected"
                        : "Not available yet"}
                    </p>
                  </div>
                  {conn ? (
                    <button
                      onClick={() => disconnectCalendar(p.id)}
                      disabled={busy}
                      className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
                    >
                      Disconnect
                    </button>
                  ) : p.configured ? (
                    <a href={`/api/integrations/${p.id}/connect`} className="btn-primary shrink-0 px-3 py-1.5 text-xs">
                      Connect
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-400">Coming soon</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

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
