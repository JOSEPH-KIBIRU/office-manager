"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, Modal, Alert, FieldError, inputCls, api } from "@/components/ui";
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
  helb_deduction: number | null;
  must_change_password: number;
  active: number;
}

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
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [changeRequests, setChangeRequests] = useState<ProfileChangeRequestRow[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [payrollFor, setPayrollFor] = useState<UserRow | null>(null);
  const [payStatutory, setPayStatutory] = useState("");
  const [payHelb, setPayHelb] = useState("");

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function load() {
    try {
      const data = await api<{ users: UserRow[] }>("/api/users?full=1");
      setUsers(data.users);
      const reqs = await api<{ requests: ProfileChangeRequestRow[] }>("/api/profile/requests");
      setChangeRequests(reqs.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
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
        json: { name, email, phone, role },
      });
      setShowNew(false);
      setName("");
      setEmail("");
      setPhone("");
      setRole("employee");
      setNotice(
        `Account for ${data.user.name} created. Temporary password: ${data.tempPassword} — it has been sent to their email${data.user.phone ? " and SMS" : ""}. They must change it at first login.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setError(null);
    try {
      const data = await api<{ tempPassword?: string | null }>(`/api/users/${id}`, { method: "PATCH", json: body });
      if (data.tempPassword) setNotice(`New temporary password: ${data.tempPassword} — sent to the user. They will be prompted to change it.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function reviewRequest(id: string, action: "approve" | "reject") {
    setError(null);
    try {
      await api(`/api/profile-requests/${id}`, { method: "PATCH", json: { action } });
      setNotice(action === "approve" ? "Change approved and applied to the account." : "Change request rejected.");
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
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

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
                    <button onClick={() => reviewRequest(r.id, "approve")} className="btn-success px-2.5 py-1 text-xs">Approve & apply</button>
                    <button onClick={() => reviewRequest(r.id, "reject")} className="btn-danger px-2.5 py-1 text-xs">Reject</button>
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
              <th>Emp No.</th>
              <th>Basic salary</th>
              <th>Leave days</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
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
                    onChange={(e) => patch(u.id, { role: e.target.value }, `Change ${u.name}'s role to ${ROLE_LABELS[e.target.value as Role]}?`)}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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
                    onClick={() => { setPayrollFor(u); setPayStatutory(u.statutory_number ?? ""); setPayHelb(u.helb_deduction != null ? String(u.helb_deduction) : ""); }}
                    className="btn-secondary px-2 py-1 text-xs"
                  >
                    Payroll
                  </button>
                  <button onClick={() => patch(u.id, { resetPassword: true }, `Reset ${u.name}'s password? A new temporary password will be sent to them.`)}
                    className="btn-secondary px-2 py-1 text-xs">
                    Reset pw
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
              <label className="label">Full name</label>
              <input className={inputCls(errors.name)} value={name}
                onChange={(e) => { setName(e.target.value); clearError("name"); }} required autoFocus />
              <FieldError msg={errors.name} />
            </div>
            <div>
              <label className="label">Work email</label>
              <input type="email" className={inputCls(errors.email)} value={email}
                onChange={(e) => { setEmail(e.target.value); clearError("email"); }} required />
              <FieldError msg={errors.email} />
            </div>
            <div>
              <label className="label">Phone (for SMS notifications)</label>
              <input className={inputCls(errors.phone)} value={phone}
                onChange={(e) => { setPhone(e.target.value); clearError("phone"); }} placeholder="+2547…" />
              <FieldError msg={errors.phone} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
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
              <label className="label">KRA / statutory number (optional)</label>
              <input className="input" value={payStatutory}
                onChange={(e) => setPayStatutory(e.target.value)} placeholder="e.g. A001234567Q" />
            </div>
            <div>
              <label className="label">HELB deduction per month (KSh, optional)</label>
              <input type="number" min={0} step="0.01" className="input" value={payHelb}
                onChange={(e) => setPayHelb(e.target.value)} placeholder="e.g. 1500" />
              <p className="mt-1 text-xs text-slate-500">Deducted from gross pay after tax on each payslip.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setPayrollFor(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
