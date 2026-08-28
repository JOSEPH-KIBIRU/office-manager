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
        { method: "POST", json: { name, adminName, adminEmail } }
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
            <label className="label">Company name</label>
            <input className={inputCls(errors.name)} value={name}
              onChange={(e) => { setName(e.target.value); clearError("name"); }} required autoFocus />
            <FieldError msg={errors.name} />
          </div>
          <div>
            <label className="label">Admin name</label>
            <input className={inputCls(errors.adminName)} value={adminName}
              onChange={(e) => { setAdminName(e.target.value); clearError("adminName"); }} required />
            <FieldError msg={errors.adminName} />
          </div>
          <div>
            <label className="label">Admin email</label>
            <input type="email" className={inputCls(errors.adminEmail)} value={adminEmail}
              onChange={(e) => { setAdminEmail(e.target.value); clearError("adminEmail"); }} required />
            <FieldError msg={errors.adminEmail} />
          </div>
          <p className="text-xs text-slate-500">
            Creates the organization, generates a temporary password for its first admin, and sends their login by email and SMS.
          </p>
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
