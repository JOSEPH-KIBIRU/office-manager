"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, FieldError, inputCls, PageHeader, api } from "@/components/ui";
import { validate, required, email as emailRule, type Errors } from "@/lib/validation";

export default function CreateCompanyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  function toggleDay(d: number) {
    setWorkingDays((prev) =>
      prev.includes(d) ? (prev.length === 1 ? prev : prev.filter((x) => x !== d)) : [...prev, d].sort((a, b) => a - b)
    );
  }

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const errs = validate({ name, adminName, adminEmail }, {
      name: [required("Company name")],
      adminName: [required("Admin name")],
      adminEmail: [required("Admin email"), emailRule("Admin email")],
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    setErrors({});
    try {
      const res = await api<{ orgId: string; adminEmail: string; tempPassword: string }>(
        "/api/admin/companies",
        { method: "POST", json: { name, adminName, adminEmail, workingDays } }
      );
      setNotice(
        `Company created. Admin account: ${res.adminEmail} with temporary password ${res.tempPassword} — save this now (shown only once). They must change it at first login.`
      );
      setName("");
      setAdminName("");
      setAdminEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Create company & admin"
        subtitle="Register a new company and its first admin account. The temp password is shown once — email/SMS delivery requires credentials to be configured."
        action={
          <button onClick={() => router.push("/admin")} className="btn-secondary">Back to companies</button>
        }
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      <div className="card max-w-2xl p-6">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="label" htmlFor="co-name">Company name</label>
            <input id="co-name" className={inputCls(errors.name)} value={name}
              onChange={(e) => { setName(e.target.value); clearError("name"); }} required autoFocus />
            <FieldError msg={errors.name} />
          </div>
          <div>
            <label className="label" htmlFor="co-admin">Admin name</label>
            <input id="co-admin" className={inputCls(errors.adminName)} value={adminName}
              onChange={(e) => { setAdminName(e.target.value); clearError("adminName"); }} required />
            <FieldError msg={errors.adminName} />
          </div>
          <div>
            <label className="label" htmlFor="co-email">Admin email</label>
            <input id="co-email" type="email" className={inputCls(errors.adminEmail)} value={adminEmail}
              onChange={(e) => { setAdminEmail(e.target.value); clearError("adminEmail"); }} required />
            <FieldError msg={errors.adminEmail} />
          </div>
          <p className="text-xs text-slate-500">
            Creates the organization and a temporary password for its first admin. The password is shown
            once below — email/SMS delivery only works if messaging is configured.
          </p>
          <div>
            <label className="label">Working days</label>
            <p className="mb-2 text-xs text-slate-500">
              Leave is deducted in actual working days — weekends and public holidays are excluded.
            </p>
            <div className="flex flex-wrap gap-2">
              {[{ v: 1, l: "Mon" }, { v: 2, l: "Tue" }, { v: 3, l: "Wed" }, { v: 4, l: "Thu" }, { v: 5, l: "Fri" }, { v: 6, l: "Sat" }, { v: 0, l: "Sun" }].map((d) => (
                <button
                  type="button"
                  key={d.v}
                  onClick={() => toggleDay(d.v)}
                  aria-pressed={workingDays.includes(d.v)}
                  className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition ${
                    workingDays.includes(d.v)
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {d.l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Creating…" : "+ Create company & admin"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
