"use client";

import { useEffect, useState, FormEvent } from "react";
import { PageHeader, Alert, FieldError, inputCls, Modal, api } from "@/components/ui";
import { PayslipLines, type PayslipDetail } from "@/components/payslip";
import { type Errors } from "@/lib/validation";
import { ROLE_LABELS, type Role } from "@/lib/types";

interface EmployeeForPayroll {
  id: string;
  name: string;
  employee_number: string | null;
  basic_salary: number | null;
  role: Role;
}

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  count: number;
  created_at: string;
  gross: number;
  net: number;
}

interface RunPayslip {
  userId: string;
  name: string;
  employeeNumber: string | null;
  role: string;
  basicSalary: number;
  allowances: number;
  leaveDaysPayout: number;
  helb: number;
  grossPay: number;
  netPay: number;
  totalDeductions: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const fmt = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [employees, setEmployees] = useState<EmployeeForPayroll[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [allowances, setAllowances] = useState<Record<string, string>>({});
  const [leavePayouts, setLeavePayouts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Errors>({});

  const [openRun, setOpenRun] = useState<string | null>(null);
  const [openPayslips, setOpenPayslips] = useState<RunPayslip[] | null>(null);
  const [runMeta, setRunMeta] = useState<{ month: number; year: number } | null>(null);
  const [viewingUser, setViewingUser] = useState<RunPayslip | null>(null);

  const [editRun, setEditRun] = useState<PayrollRun | null>(null);
  const [editSlips, setEditSlips] = useState<RunPayslip[] | null>(null);

  async function load() {
    try {
      const data = await api<{ payrolls: PayrollRun[] }>("/api/payroll");
      setRuns(data.payrolls);
      const users = await api<{ users: EmployeeForPayroll[] }>("/api/users?full=1");
      setEmployees(users.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payroll data");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  const eligible = employees.filter((e) => e.basic_salary && e.basic_salary > 0);
  const selectedCount = eligible.filter((e) => selected[e.id]).length;
  const allSelected = eligible.length > 0 && selectedCount === eligible.length;

  function toggleSelect(id: string) {
    setSelected((p) => ({ ...p, [id]: !p[id] }));
    setErrors((p) => ({ ...p, selected: undefined }));
  }

  function toggleAll() {
    if (allSelected) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      for (const e of eligible) next[e.id] = true;
      setSelected(next);
    }
  }

  async function runPayroll(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    setErrors({});
    const selectedIds = eligible.filter((ee) => selected[ee.id]).map((ee) => ee.id);
    if (selectedIds.length === 0) {
      setErrors({ selected: "Select at least one employee to include in this payroll run." });
      setBusy(false);
      return;
    }
    try {
      const result = await api<{ id: string; count: number }>("/api/payroll", {
        method: "POST",
        json: {
          month,
          year,
          employeeIds: selectedIds,
          allowances: Object.entries(allowances)
            .filter(([, v]) => v !== "" && Number(v) > 0)
            .map(([userId, amount]) => ({ userId, amount: Number(amount) })),
          leaveDaysPayouts: Object.entries(leavePayouts)
            .filter(([, v]) => v !== "" && Number(v) > 0)
            .map(([userId, amount]) => ({ userId, amount: Number(amount) })),
        },
      });
      setNotice(`Payroll ${MONTHS[month - 1]} ${year} processed — ${result.count} payslip(s) generated for ${selectedIds.length} selected employee(s).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run payroll");
    } finally {
      setBusy(false);
    }
  }

  async function showRun(id: string) {
    try {
      const data = await api<{ month: number; year: number; payslips: RunPayslip[] }>(`/api/payroll/${id}`);
      setOpenPayslips(data.payslips);
      setRunMeta({ month: data.month, year: data.year });
      setOpenRun(id);
      setViewingUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run");
    }
  }

  async function openEdit(r: PayrollRun) {
    setError(null);
    try {
      const data = await api<{ month: number; year: number; payslips: RunPayslip[] }>(`/api/payroll/${r.id}`);
      setEditRun(r);
      setEditSlips(data.payslips);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run for editing");
    }
  }

  function updateEditSlip(userId: string, field: "basicSalary" | "allowances" | "leaveDaysPayout" | "helb", val: string) {
    if (!editSlips) return;
    setEditSlips((prev) =>
      (prev ?? []).map((s) => (s.userId === userId ? { ...s, [field]: val === "" ? 0 : Number(val) } : s))
    );
  }

  async function saveEdit() {
    if (!editRun || !editSlips) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/payroll/${editRun.id}`, {
        method: "PATCH",
        json: {
          basicSalaries: editSlips.map((s) => ({ userId: s.userId, amount: s.basicSalary })),
          allowances: editSlips.map((s) => ({ userId: s.userId, amount: s.allowances })),
          leaveDaysPayouts: editSlips.map((s) => ({ userId: s.userId, amount: s.leaveDaysPayout })),
          helbDeductions: editSlips.map((s) => ({ userId: s.userId, amount: s.helb })),
        },
      });
      setNotice(`Payroll ${MONTHS[editRun.month - 1]} ${editRun.year} updated — payslips recalculated.`);
      setEditRun(null);
      setEditSlips(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payroll");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRun(r: PayrollRun) {
    if (!window.confirm(`Delete payroll for ${MONTHS[r.month - 1]} ${r.year}? This removes all its payslips and cannot be undone.`)) return;
    setError(null);
    try {
      await api(`/api/payroll/${r.id}`, { method: "DELETE" });
      setNotice(`Payroll for ${MONTHS[r.month - 1]} ${r.year} deleted.`);
      if (openRun === r.id) { setOpenRun(null); setOpenPayslips(null); }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete payroll");
    }
  }

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Process monthly salaries with automatic Kenyan statutory deductions (PAYE, NSSF, SHIF, Affordable Housing Levy, HELB)."
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      <div className="card mb-6 p-5">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Run payroll for a month</h2>
        <form onSubmit={runPayroll} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="label">Month</label>
              <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <input
                type="number"
                className={inputCls(errors.year)}
                value={year}
                min={2000}
                max={2100}
                onChange={(e) => { setYear(Number(e.target.value)); clearError("year"); }}
              />
              <FieldError msg={errors.year} />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-12">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-indigo-600" />
                    </label>
                  </th>
                  <th>Employee</th>
                  <th>Emp No.</th>
                  <th>Basic salary</th>
                  <th>Allowance (KSh)</th>
                  <th>Leave payout (KSh)</th>
                </tr>
              </thead>
              <tbody>
                {eligible
                  .map((e) => (
                    <tr key={e.id} className={selected[e.id] ? "bg-indigo-50/60" : ""}>
                      <td>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input type="checkbox" checked={!!selected[e.id]} onChange={() => toggleSelect(e.id)} className="h-4 w-4 accent-indigo-600" />
                        </label>
                      </td>
                      <td className="font-medium">
                        {e.name}
                        <span className="ml-2 text-xs text-slate-400 capitalize">{ROLE_LABELS[e.role]}</span>
                      </td>
                      <td>{e.employee_number ?? "—"}</td>
                      <td>{e.basic_salary !== null ? fmt(e.basic_salary) : "—"}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="input w-32 py-1 text-xs"
                          placeholder="0.00"
                          value={allowances[e.id] ?? ""}
                          onChange={(ev) => { setAllowances((p) => ({ ...p, [e.id]: ev.target.value })); void e.id; }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="input w-32 py-1 text-xs"
                          placeholder="0.00"
                          value={leavePayouts[e.id] ?? ""}
                          onChange={(ev) => setLeavePayouts((p) => ({ ...p, [e.id]: ev.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                {eligible.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    No employees with a basic salary set yet. Set salaries on the Team page first.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="text-sm text-slate-600">
              <span className="font-medium">{selectedCount}</span> of {eligible.length} employee(s) selected
              {allSelected && eligible.length > 0 && <span className="ml-2 text-xs text-indigo-600">(all)</span>}
              <FieldError msg={errors.selected} />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Processing…" : `Process payroll (${selectedCount})`}
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Payroll history</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Period</th>
              <th className="text-right">Employees</th>
              <th className="text-right">Gross</th>
              <th className="text-right">Net</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{MONTHS[r.month - 1]} {r.year}</td>
                <td className="text-right">{r.count}</td>
                <td className="text-right">{fmt(r.gross)}</td>
                <td className="text-right text-emerald-700">{fmt(r.net)}</td>
                <td className="text-slate-500">{r.created_at}</td>
                <td className="whitespace-nowrap text-right">
                  <button
                    onClick={() => (openRun === r.id ? setOpenRun(null) : showRun(r.id))}
                    className="btn-secondary px-2 py-1 text-xs"
                  >
                    {openRun === r.id ? "Hide" : "View payslips"}
                  </button>
                  <button onClick={() => openEdit(r)} className="btn-secondary ml-1 px-2 py-1 text-xs">Edit</button>
                  <button onClick={() => deleteRun(r)} className="btn-danger ml-1 px-2 py-1 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">No payroll runs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openPayslips && openRun && (
        <div className="card mt-6 overflow-x-auto">
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
            Payslips — {runMeta ? MONTHS[runMeta.month - 1] + " " + runMeta.year : ""}
          </h2>
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Emp No.</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Net</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {openPayslips.map((p) => (
                <tr key={p.userId}>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.employeeNumber ?? "—"}</td>
                  <td className="text-right">{fmt(p.grossPay)}</td>
                  <td className="text-right text-emerald-700">{fmt(p.netPay)}</td>
                  <td className="whitespace-nowrap text-right">
                    <button onClick={() => setViewingUser(p)} className="btn-secondary px-3 py-1 text-xs">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingUser && openRun && (
        <PayslipModal
          payrollId={openRun}
          userId={viewingUser.userId}
          label={viewingUser.name}
          onClose={() => setViewingUser(null)}
        />
      )}

      {editRun && editSlips && (
        <Modal title={`Edit payroll — ${MONTHS[editRun.month - 1]} ${editRun.year}`} onClose={() => { setEditRun(null); setEditSlips(null); }}>
          <p className="mb-3 text-sm text-slate-500">
            Adjust basic salary, allowances, leave payouts or HELB. The payslips are recalculated automatically.
          </p>
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="table-base w-full">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Basic</th>
                  <th>Allowance</th>
                  <th>Leave</th>
                  <th>HELB</th>
                </tr>
              </thead>
              <tbody>
                {editSlips.map((s) => (
                  <tr key={s.userId}>
                    <td className="font-medium">{s.name}</td>
                    <td><input type="number" min={0} className="input w-24 py-1 text-xs" value={s.basicSalary} onChange={(e) => updateEditSlip(s.userId, "basicSalary", e.target.value)} /></td>
                    <td><input type="number" min={0} className="input w-24 py-1 text-xs" value={s.allowances} onChange={(e) => updateEditSlip(s.userId, "allowances", e.target.value)} /></td>
                    <td><input type="number" min={0} className="input w-24 py-1 text-xs" value={s.leaveDaysPayout} onChange={(e) => updateEditSlip(s.userId, "leaveDaysPayout", e.target.value)} /></td>
                    <td><input type="number" min={0} className="input w-24 py-1 text-xs" value={s.helb} onChange={(e) => updateEditSlip(s.userId, "helb", e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => { setEditRun(null); setEditSlips(null); }}>Cancel</button>
            <button className="btn-primary" onClick={saveEdit} disabled={busy}>
              {busy ? "Saving…" : "Save & recalculate"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function PayslipModal({
  payrollId,
  userId,
  label,
  onClose,
}: {
  payrollId: string;
  userId: string;
  label: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PayslipDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<PayslipDetail>(`/api/payroll/payslip/${payrollId}?userId=${userId}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [payrollId, userId]);

  if (err) return <div className="card mt-6 p-5"><Alert kind="error">{err}</Alert></div>;
  if (!data) return <div className="card mt-6 p-5 text-sm text-slate-500">Loading payslip…</div>;

  return (
    <div className="card mt-6">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-600">Payslip — {MONTHS[data.month - 1]} {data.year} · {label}</h2>
        <button
          onClick={() => window.open(`/payslip/${payrollId}?userId=${userId}`, "_blank")}
          className="btn-primary px-3 py-1 text-xs"
        >
          Open printable / PDF
        </button>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
      </div>
      <div className="p-5">
        <p className="mb-2 text-xs text-slate-500">Employee: {data.name} · Emp No: {data.employeeNumber ?? "—"} · {ROLE_LABELS[data.role as Role]}</p>
        <PayslipLines data={data} />
      </div>
    </div>
  );
}


