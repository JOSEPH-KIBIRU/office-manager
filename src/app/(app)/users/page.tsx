"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, Modal, Alert, FieldError, inputCls, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { validate, required, email as emailRule, phone as phoneRule, type Errors } from "@/lib/validation";
import type { ProfileChangeRequestRow, Role } from "@/lib/types";

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  leave_balance: number;
  employee_number: string | null;
  basic_salary: number | null;
  statutory_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
  mpesa_number: string | null;
  employment_type: string;
  helb_deduction: number | null;
  department_id: string | null;
  must_change_password: number;
  active: number;
}

const EMPLOYMENT_TYPES = ["permanent", "permanent_pensionable"] as const;
const EMPLOYMENT_LABELS: Record<string, string> = {
  permanent: "Permanent",
  permanent_pensionable: "Permanent & Pensionable",
};

const ROLES: Role[] = ["admin", "secretary", "manager", "employee"];
const ROLE_LABELS: Record<Role, string> = {
  admin: "Director / Admin",
  secretary: "Secretary",
  manager: "Manager",
  employee: "Employee",
  super_admin: "Platform Owner",
};

export default function UsersPage() {
  const session = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingReset, setPendingReset] = useState<{ id: string; name: string; phone: string | null; email: string } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetDone, setResetDone] = useState<{ name: string; tempPassword: string; phone: string | null; email: string } | null>(null);
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [employmentType, setEmploymentType] = useState<string>("permanent");
  const [changeRequests, setChangeRequests] = useState<ProfileChangeRequestRow[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [payrollFor, setPayrollFor] = useState<UserRow | null>(null);
  const [payStatutory, setPayStatutory] = useState("");
  const [payHelb, setPayHelb] = useState("");
  const [payBankName, setPayBankName] = useState("");
  const [payBankAccount, setPayBankAccount] = useState("");
  const [payMpesa, setPayMpesa] = useState("");

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ users: UserRow[] }>("/api/users?full=1");
      setUsers(data.users);
      const reqs = await api<{ requests: ProfileChangeRequestRow[] }>("/api/profile/requests");
      setChangeRequests(reqs.requests);
      const depts = await api<{ departments: { id: string; name: string }[]; employees: unknown[] }>(
        "/api/departments"
      );
      setDepartments(depts.departments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const errs = validate({ name, email, phone }, {
      name: [required("Full name")],
      email: [required("Work email"), emailRule("Work email")],
      phone: [phoneRule("Phone number")],
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    setErrors({});
    try {
      const data = await api<{ user: UserRow; tempPassword: string }>("/api/users", {
        method: "POST",
        json: { name, email, phone, role, employment_type: employmentType },
      });
      setShowNew(false);
      setName("");
      setEmail("");
      setPhone("");
      setRole("employee");
      setEmploymentType("permanent");
      toast.success(
        `Account for ${data.user.name} created. Temporary password: ${data.tempPassword} — it has been sent to their email${data.user.phone ? " and SMS" : ""}. They must change it at first login.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    try {
      const data = await api<{ tempPassword?: string | null }>(`/api/users/${id}`, { method: "PATCH", json: body });
      if (data.tempPassword) toast.success(`New temporary password: ${data.tempPassword} — sent to the user. They will be prompted to change it.`);
      toast.success("Account updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function confirmReset() {
    const u = pendingReset;
    if (!u) return;
    setResetBusy(true);
    try {
      const data = await api<{ tempPassword?: string | null }>(`/api/users/${u.id}`, { method: "PATCH", json: { resetPassword: true } });
      setPendingReset(null);
      if (data.tempPassword) {
        setResetDone({ name: u.name, tempPassword: data.tempPassword, phone: u.phone, email: u.email });
      } else {
        toast.success("Password reset.");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetBusy(false);
    }
  }

  function copyResetPassword(pw: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(pw).then(() => toast.success("Password copied")).catch(() => toast.error("Copy failed"));
    } else {
      toast.error("Copy is not supported in this browser");
    }
  }

  async function reviewRequest(id: string, action: "approve" | "reject") {
    setError(null);
    try {
      await api(`/api/profile-requests/${id}`, { method: "PATCH", json: { action } });
      toast.success(action === "approve" ? "Change approved and applied to the account." : "Change request rejected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Create accounts, assign roles and manage access. New logins are emailed/SMS'd automatically."
        action={<button className="btn-primary" onClick={() => setShowNew(true)}>+ Create user</button>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {changeRequests.filter((r) => r.status === "pending").length > 0 && (
        <section className="card mb-6 overflow-hidden">
          <h2 className="border-b border-slate-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Pending profile change requests
          </h2>
          <table className="table-base">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Field</th>
                <th>Current</th>
                <th>Requested</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {changeRequests.filter((r) => r.status === "pending").map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.requester_name}</td>
                  <td className="capitalize">{r.field}</td>
                  <td>{r.current_value ?? "—"}</td>
                  <td>{r.requested_value}</td>
                  <td className="space-x-2 whitespace-nowrap text-right">
                    <button onClick={() => reviewRequest(r.id, "approve")} className="btn-success btn-xs">Approve & apply</button>
                    <button onClick={() => reviewRequest(r.id, "reject")} className="btn-danger btn-xs">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Department</th>
              <th>Emp No.</th>
              <th>Employment type</th>
              <th>Basic salary</th>
              <th>Leave days</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} className="py-8 text-center text-slate-500">Loading team…</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={11} className="py-8 text-center text-slate-500">No team members yet. Add your first user.</td></tr>
            )}
            {!loading && users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td className="font-medium">
                  {u.name}
                  {u.id === session.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                  {u.must_change_password === 1 && <span className="badge ml-2 bg-amber-100 text-amber-800">temp password</span>}
                </td>
                <td>{u.email}</td>
                <td>{u.phone ?? "—"}</td>
                <td>
                  <select
                    className="input py-1 text-xs capitalize"
                    value={u.role}
                    disabled={u.id === session.id}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className="input py-1 text-xs"
                    value={u.department_id ?? ""}
                    disabled={u.id === session.id}
                    onChange={(e) => patch(u.id, { department_id: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    className="input w-24 py-1 text-xs"
                    defaultValue={u.employee_number ?? ""}
                    placeholder="EMP-001"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (u.employee_number ?? "")) patch(u.id, { employee_number: v });
                    }}
                  />
                </td>
                <td>
                  <select
                    className="input py-1 text-xs"
                    value={u.employment_type || "permanent"}
                    disabled={u.id === session.id}
                    onChange={(e) => patch(u.id, { employment_type: e.target.value })}
                  >
                    {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_LABELS[t]}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    className="input w-28 py-1 text-xs"
                    defaultValue={u.basic_salary ?? ""}
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      const cur = u.basic_salary;
                      if ((v === null && cur !== null) || (v !== null && v !== cur)) patch(u.id, { basic_salary: v });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input w-20 py-1 text-xs"
                    defaultValue={u.leave_balance}
                    min={0}
                    max={365}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== u.leave_balance) patch(u.id, { leave_balance: v });
                    }}
                  />
                </td>
                <td>
                  <span className={`badge ${u.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                    {u.active ? "active" : "disabled"}
                  </span>
                </td>
                <td className="space-x-1.5 whitespace-nowrap text-right">
                  <button
                    onClick={() => { setPayrollFor(u); setPayStatutory(u.statutory_number ?? ""); setPayHelb(u.helb_deduction != null ? String(u.helb_deduction) : ""); setPayBankName(u.bank_name ?? ""); setPayBankAccount(u.bank_account ?? ""); setPayMpesa(u.mpesa_number ?? ""); }}
                    className="btn-secondary btn-xs"
                  >
                    Payroll
                  </button>
                  <button onClick={() => setPendingReset({ id: u.id, name: u.name, phone: u.phone, email: u.email })}
                    className="btn-secondary btn-xs">
                    Reset password
                  </button>
                  {u.id !== session.id && (
                    <button onClick={() => patch(u.id, { active: !u.active })}
                      className={`px-2 py-1 btn-secondary text-xs ${u.active ? "text-red-600" : "text-emerald-700"}`}>
                      {u.active ? "Disable" : "Enable"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <Modal title="Create a new user" onClose={() => setShowNew(false)}>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="label" htmlFor="nu-name">Full name</label>
              <input id="nu-name" className={inputCls(errors.name)} value={name}
                onChange={(e) => { setName(e.target.value); clearError("name"); }} required autoFocus />
              <FieldError msg={errors.name} />
            </div>
            <div>
              <label className="label" htmlFor="nu-email">Work email</label>
              <input id="nu-email" type="email" className={inputCls(errors.email)} value={email}
                onChange={(e) => { setEmail(e.target.value); clearError("email"); }} required />
              <FieldError msg={errors.email} />
            </div>
            <div>
              <label className="label" htmlFor="nu-phone">Phone (for SMS notifications)</label>
              <input id="nu-phone" className={inputCls(errors.phone)} value={phone}
                onChange={(e) => { setPhone(e.target.value); clearError("phone"); }} placeholder="+2547…" />
              <FieldError msg={errors.phone} />
            </div>
            <div>
              <label className="label" htmlFor="nu-role">Role</label>
              <select id="nu-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nu-emptype">Employment type</label>
              <select id="nu-emptype" className="input" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_LABELS[t]}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Permanent &amp; Pensionable employees get a 6% pension contribution (tax-deductible, capped at KSh 30,000/month) on top of NSSF.
              </p>
            </div>
            <p className="text-xs text-slate-500">
              A temporary password is generated and sent to the user by email and SMS. They will be required to change it on first login.
              New users start with 21 annual leave days.
            </p>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Creating…" : "Create & send logins"}
            </button>
          </form>
        </Modal>
      )}

      {payrollFor && (
        <Modal title={`Payroll details — ${payrollFor.name}`} onClose={() => setPayrollFor(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const body: Record<string, unknown> = {
                statutory_number: payStatutory,
                helb_deduction: payHelb === "" ? null : Number(payHelb),
                bank_name: payBankName,
                bank_account: payBankAccount,
                mpesa_number: payMpesa,
              };
              patch(payrollFor.id, body);
              setPayrollFor(null);
            }}
          >
            <div>
              <label className="label">Basic salary</label>
              <p className="text-sm">
                Set in the <strong>Basic salary</strong> column of the team table. Only employees with a basic salary are included when payroll is processed.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="pd-statutory">KRA / statutory number (optional)</label>
              <input id="pd-statutory" className="input" value={payStatutory}
                onChange={(e) => setPayStatutory(e.target.value)} placeholder="e.g. A001234567Q" />
            </div>
            <div>
              <label className="label" htmlFor="pd-helb">HELB deduction per month (KSh, optional)</label>
              <input id="pd-helb" type="number" min={0} step="0.01" className="input" value={payHelb}
                onChange={(e) => setPayHelb(e.target.value)} placeholder="e.g. 1500" />
              <p className="mt-1 text-xs text-slate-500">Deducted from gross pay after tax on each payslip.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="pd-bank">Bank name (optional)</label>
                <input id="pd-bank" className="input" value={payBankName} onChange={(e) => setPayBankName(e.target.value)} placeholder="e.g. Equity" />
              </div>
              <div>
                <label className="label" htmlFor="pd-acct">Bank account number (optional)</label>
                <input id="pd-acct" className="input" value={payBankAccount} onChange={(e) => setPayBankAccount(e.target.value)} placeholder="e.g. 0123456789" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="pd-mpesa">M-Pesa number (optional)</label>
              <input id="pd-mpesa" type="tel" className="input" value={payMpesa} onChange={(e) => setPayMpesa(e.target.value)} placeholder="e.g. 0712345678" />
              <p className="mt-1 text-xs text-slate-500">Used when exporting the M-Pesa / B2C payment file.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setPayrollFor(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!pendingReset}
        title="Reset password"
        message={<span>Reset <strong>{pendingReset?.name}</strong>&apos;s password? A new temporary password will be generated, sent to them, and shown here so you can copy it.</span>}
        busy={resetBusy}
        confirmLabel="Reset password"
        onConfirm={confirmReset}
        onCancel={() => setPendingReset(null)}
      />

      {resetDone && (
        <Modal title="Password reset" onClose={() => setResetDone(null)}>
          <p className="text-sm text-slate-600">
            A new temporary password was generated for <strong>{resetDone.name}</strong>. They must change it at their next login.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Sent to {resetDone.email}
            {resetDone.phone ? ` and ${resetDone.phone}` : ""} — or copy it below and share it directly.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm tracking-wide">{resetDone.tempPassword}</code>
            <button className="btn-primary" onClick={() => copyResetPassword(resetDone.tempPassword)}>Copy</button>
          </div>
          <div className="mt-4 flex justify-end">
            <button className="btn-secondary" onClick={() => setResetDone(null)}>Done</button>
          </div>
        </Modal>
      )}
    </>
  );
}
