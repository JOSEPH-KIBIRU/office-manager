"use client";

import { useEffect, useState, FormEvent } from "react";
import { PageHeader, Alert, FieldError, inputCls, Modal, ConfirmDialog, HelpTip, api } from "@/components/ui";
import { PayslipLines, type PayslipDetail } from "@/components/payslip";
import { type Errors } from "@/lib/validation";
import { ROLE_LABELS, type Role } from "@/lib/types";

interface EmployeeForPayroll {
  id: string;
  name: string;
  employee_number: string | null;
  basic_salary: number | null;
  statutory_number: string | null;
  role: Role;
}

interface CasualRow {
  id: string;
  name: string;
  phone: string | null;
  idNumber: string | null;
  dailyRate: number;
  active: boolean;
  created_at: string;
}

interface StaffLoanRow {
  id: string;
  userId: string;
  userName: string;
  kind: "loan" | "advance";
  principal: number;
  balance: number;
  monthlyDeduction: number;
  description: string | null;
  active: boolean;
  created_at: string;
}

interface AttendanceRow {
  id: string;
  casualId: string;
  casualName: string;
  date: string;
  days: number;
  note: string | null;
  created_at: string;
}

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  count: number;
  created_at: string;
  gross: number;
  net: number;
  paid: boolean;
  paid_at: string | null;
}

interface RunPayslip {
  userId: string | null;
  casualId: string | null;
  personType: "employee" | "casual";
  name: string;
  employeeNumber: string | null;
  role: string;
  basicSalary: number;
  allowances: number;
  perDiem: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimePay: number;
  bonus: number;
  leaveDaysPayout: number;
  daysWorked: number | null;
  dailyRate: number | null;
  statutory: boolean;
  helb: number;
  loanRepayment: number;
  otherDeductions: number;
  grossPay: number;
  netPay: number;
  totalDeductions: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const fmt = (n: number) => "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyCasualForm = { name: "", phone: "", idNumber: "", dailyRate: "" };
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [employees, setEmployees] = useState<EmployeeForPayroll[]>([]);
  const [casuals, setCasuals] = useState<CasualRow[]>([]);
  const [loans, setLoans] = useState<StaffLoanRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingRun, setDeletingRun] = useState<PayrollRun | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [p9Year, setP9Year] = useState(now.getFullYear());
  const [allowances, setAllowances] = useState<Record<string, string>>({});
  const [perDiem, setPerDiem] = useState<Record<string, string>>({});
  const [otHours, setOtHours] = useState<Record<string, string>>({});
  const [otRate, setOtRate] = useState<Record<string, string>>({});
  const [bonuses, setBonuses] = useState<Record<string, string>>({});
  const [otherDed, setOtherDed] = useState<Record<string, string>>({});
  const [leavePayouts, setLeavePayouts] = useState<Record<string, string>>({});
  const [encashmentIds, setEncashmentIds] = useState<string[]>([]);
  // encashment row id -> employee id, so only rows for selected staff get marked paid.
  const [encashmentUserIds, setEncashmentUserIds] = useState<Record<string, string>>({});
  // Year the encashment prefill was built for; guards against month/year changes.
  const [encashmentYear, setEncashmentYear] = useState<number | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [casualSelected, setCasualSelected] = useState<Record<string, boolean>>({});
  const [casualDays, setCasualDays] = useState<Record<string, string>>({});
  const [casualStatutory, setCasualStatutory] = useState<Record<string, boolean>>({});
  const [casualPerDiem, setCasualPerDiem] = useState<Record<string, string>>({});

  const [errors, setErrors] = useState<Errors>({});
  const [confirmRun, setConfirmRun] = useState(false);
  const [costCentres, setCostCentres] = useState<{ code: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ _id: string; name: string }[]>([]);
  const [costCentre, setCostCentre] = useState("");
  const [project, setProject] = useState("");

  useEffect(() => {
    api<{ costCentres: { code: string; name: string }[] }>("/api/management/cost-centres").then((d) => setCostCentres(d.costCentres ?? [])).catch(() => setCostCentres([]));
    api<{ projects: { _id: string; name: string }[] }>("/api/management/projects").then((d) => setProjects(d.projects ?? [])).catch(() => setProjects([]));
  }, []);

  const [openRun, setOpenRun] = useState<string | null>(null);
  const [openPayslips, setOpenPayslips] = useState<RunPayslip[] | null>(null);
  const [runMeta, setRunMeta] = useState<{ month: number; year: number } | null>(null);
  const [viewingUser, setViewingUser] = useState<RunPayslip | null>(null);

  const [editRun, setEditRun] = useState<PayrollRun | null>(null);
  const [editSlips, setEditSlips] = useState<RunPayslip[] | null>(null);

  // Casual worker management
  const [casualModal, setCasualModal] = useState<CasualRow | "new" | null>(null);
  const [casualForm, setCasualForm] = useState(emptyCasualForm);
  const [casualBusy, setCasualBusy] = useState(false);
  const [casualError, setCasualError] = useState<string | null>(null);
  const [deletingCasual, setDeletingCasual] = useState<CasualRow | null>(null);

  // Staff loans
  const [loanModal, setLoanModal] = useState<StaffLoanRow | "new" | null>(null);
  const [loanForm, setLoanForm] = useState({ userId: "", kind: "loan", principal: "", monthlyDeduction: "", description: "" });
  const [loanBusy, setLoanBusy] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [deletingLoan, setDeletingLoan] = useState<StaffLoanRow | null>(null);

  // Casual attendance
  const [attForm, setAttForm] = useState({ casualId: "", date: todayISO(), days: "1", note: "" });
  const [attBusy, setAttBusy] = useState(false);

  async function load() {
    try {
      const data = await api<{ payrolls: PayrollRun[] }>("/api/payroll");
      setRuns(data.payrolls);
      const users = await api<{ users: EmployeeForPayroll[] }>("/api/users?full=1");
      setEmployees(users.users);
      const cs = await api<{ casuals: CasualRow[] }>("/api/casuals");
      setCasuals(cs.casuals);
      const ls = await api<{ loans: StaffLoanRow[] }>("/api/staff-loans");
      setLoans(ls.loans);
      await loadAttendance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payroll data");
    }
  }

  async function loadAttendance() {
    try {
      const at = await api<{ records: AttendanceRow[]; summary: Record<string, number> | null }>(
        `/api/casual-attendance?month=${month}&year=${year}`
      );
      setAttendance(at.records);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  const eligible = employees.filter((e) => e.basic_salary && e.basic_salary > 0);
  const casualsEligible = casuals.filter((c) => c.active);
  const selectedCount =
    eligible.filter((e) => selected[e.id]).length + casualsEligible.filter((c) => casualSelected[c.id]).length;
  const allSelected = eligible.length > 0 && eligible.filter((e) => selected[e.id]).length === eligible.length;
  const allCasualsSelected =
    casualsEligible.length > 0 && casualsEligible.filter((c) => casualSelected[c.id]).length === casualsEligible.length;

  function toggleSelect(id: string) {
    setSelected((p) => ({ ...p, [id]: !p[id] }));
    setErrors((p) => ({ ...p, selected: undefined }));
  }
  function toggleAll() {
    if (allSelected) setSelected({});
    else {
      const next: Record<string, boolean> = {};
      for (const e of eligible) next[e.id] = true;
      setSelected(next);
    }
  }
  function toggleCasual(id: string) {
    setCasualSelected((p) => ({ ...p, [id]: !p[id] }));
    setErrors((p) => ({ ...p, selected: undefined }));
  }
  function toggleAllCasuals() {
    if (allCasualsSelected) setCasualSelected({});
    else {
      const next: Record<string, boolean> = {};
      for (const c of casualsEligible) next[c.id] = true;
      setCasualSelected(next);
    }
  }

  function casualGross(c: CasualRow) {
    return c.dailyRate * (Number(casualDays[c.id]) || 0) + (Number(casualPerDiem[c.id]) || 0);
  }

  function requestRun(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setErrors({});
    const employeeIds = eligible.filter((ee) => selected[ee.id]).map((ee) => ee.id);
    const casualIds = casualsEligible.filter((c) => casualSelected[c.id]).map((c) => c.id);
    if (employeeIds.length === 0 && casualIds.length === 0) {
      setErrors({ selected: "Select at least one employee or casual worker to include in this payroll run." });
      return;
    }
    setConfirmRun(true);
  }

  async function doRun() {
    const employeeIds = eligible.filter((ee) => selected[ee.id]).map((ee) => ee.id);
    const casualPayload = casualsEligible
      .filter((c) => casualSelected[c.id])
      .map((c) => ({
        casualId: c.id,
        days: Number(casualDays[c.id]) || 0,
        statutory: casualStatutory[c.id] ?? true,
        perDiem: Number(casualPerDiem[c.id]) || 0,
      }));
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ id: string; count: number }>("/api/payroll", {
        method: "POST",
        json: {
          month,
          year,
          employeeIds,
          allowances: mapAmounts(allowances),
          perDiems: mapAmounts(perDiem),
          overtime: Object.keys(otHours)
            .filter((k) => Number(otHours[k]) > 0 && Number(otRate[k]) > 0)
            .map((userId) => ({ userId, hours: Number(otHours[userId]), rate: Number(otRate[userId]) })),
          bonuses: mapAmounts(bonuses),
          otherDeductions: mapAmounts(otherDed),
          leaveDaysPayouts: mapAmounts(leavePayouts),
          casuals: casualPayload,
          // Only mark encashments paid for employees actually in this run, and
          // only if the prefill still matches the selected year.
          encashmentIds:
            encashmentYear === year
              ? encashmentIds.filter((id) => {
                  const enc = encashmentUserIds[id];
                  return !!enc && employeeIds.includes(enc);
                })
                : [],
          costCenterCode: costCentre || undefined,
          projectId: project || undefined,
        },
      });
      setConfirmRun(false);
      setNotice(`Payroll ${MONTHS[month - 1]} ${year} processed — ${result.count} payslip(s) generated.`);
      setSelected({});
      setCasualSelected({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run payroll");
    } finally {
      setBusy(false);
    }
  }

  function mapAmounts(rec: Record<string, string>) {
    return Object.entries(rec)
      .filter(([, v]) => v !== "" && Number(v) > 0)
      .map(([userId, amount]) => ({ userId, amount: Number(amount) }));
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

  async function markPaid(r: PayrollRun, paid: boolean) {
    try {
      await api(`/api/payroll/${r.id}`, { method: "PATCH", json: { paid, paymentMethod: "bank" } });
      setNotice(paid ? `Payroll ${MONTHS[r.month - 1]} ${r.year} marked as paid.` : `Payment status cleared.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment status");
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

  function updateEditSlip(
    key: string,
    field: "basicSalary" | "allowances" | "perDiem" | "overtimePay" | "bonus" | "otherDeductions" | "leaveDaysPayout" | "helb" | "daysWorked",
    val: string
  ) {
    if (!editSlips) return;
    setEditSlips((prev) =>
      (prev ?? []).map((s) => ((s.userId ?? s.casualId) === key ? { ...s, [field]: val === "" ? 0 : Number(val) } : s))
    );
  }

  async function saveEdit() {
    if (!editRun || !editSlips) return;
    const emps = editSlips.filter((s) => s.personType !== "casual" && s.userId);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/payroll/${editRun.id}`, {
        method: "PATCH",
        json: {
          basicSalaries: emps.map((s) => ({ userId: s.userId, amount: s.basicSalary })),
          allowances: emps.map((s) => ({ userId: s.userId, amount: s.allowances })),
          perDiems: emps.map((s) => ({ userId: s.userId, amount: s.perDiem })),
          overtimeAmounts: emps.map((s) => ({ userId: s.userId, amount: s.overtimePay })),
          bonuses: emps.map((s) => ({ userId: s.userId, amount: s.bonus })),
          otherDeductions: emps.map((s) => ({ userId: s.userId, amount: s.otherDeductions })),
          leaveDaysPayouts: emps.map((s) => ({ userId: s.userId, amount: s.leaveDaysPayout })),
          helbDeductions: emps.map((s) => ({ userId: s.userId, amount: s.helb })),
          casualDays: editSlips
            .filter((s) => s.personType === "casual" && s.casualId)
            .map((s) => ({ casualId: s.casualId, days: s.daysWorked ?? 0 })),
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

  async function deleteRun() {
    const r = deletingRun;
    if (!r) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await api(`/api/payroll/${r.id}`, { method: "DELETE" });
      setNotice(`Payroll for ${MONTHS[r.month - 1]} ${r.year} deleted.`);
      setDeletingRun(null);
      if (openRun === r.id) { setOpenRun(null); setOpenPayslips(null); }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete payroll");
    } finally {
      setDeleteBusy(false);
    }
  }

  // ---- casual workers ----
  function openNewCasual() {
    setCasualForm(emptyCasualForm);
    setCasualError(null);
    setCasualModal("new");
  }
  function openEditCasual(c: CasualRow) {
    setCasualForm({ name: c.name, phone: c.phone ?? "", idNumber: c.idNumber ?? "", dailyRate: String(c.dailyRate) });
    setCasualError(null);
    setCasualModal(c);
  }
  async function saveCasual(e: FormEvent) {
    e.preventDefault();
    setCasualBusy(true);
    setCasualError(null);
    try {
      const payload = {
        name: casualForm.name,
        phone: casualForm.phone,
        idNumber: casualForm.idNumber,
        dailyRate: Number(casualForm.dailyRate) || 0,
      };
      if (casualModal === "new") {
        await api("/api/casuals", { method: "POST", json: payload });
        setNotice(`Casual worker ${casualForm.name} added.`);
      } else if (casualModal) {
        await api(`/api/casuals/${casualModal.id}`, { method: "PATCH", json: payload });
        setNotice("Casual worker updated.");
      }
      setCasualModal(null);
      await load();
    } catch (err) {
      setCasualError(err instanceof Error ? err.message : "Failed to save casual worker");
    } finally {
      setCasualBusy(false);
    }
  }
  async function deleteCasual() {
    const c = deletingCasual;
    if (!c) return;
    setCasualBusy(true);
    try {
      await api(`/api/casuals/${c.id}`, { method: "DELETE" });
      setNotice(`Casual worker ${c.name} removed.`);
      setDeletingCasual(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete casual worker");
    } finally {
      setCasualBusy(false);
    }
  }

  // ---- loans ----
  function openNewLoan() {
    setLoanForm({ userId: "", kind: "loan", principal: "", monthlyDeduction: "", description: "" });
    setLoanError(null);
    setLoanModal("new");
  }
  function openEditLoan(l: StaffLoanRow) {
    setLoanForm({
      userId: l.userId,
      kind: l.kind,
      principal: String(l.principal),
      monthlyDeduction: String(l.monthlyDeduction),
      description: l.description ?? "",
    });
    setLoanError(null);
    setLoanModal(l);
  }
  async function saveLoan(e: FormEvent) {
    e.preventDefault();
    setLoanBusy(true);
    setLoanError(null);
    try {
      if (loanModal === "new") {
        await api("/api/staff-loans", {
          method: "POST",
          json: {
            userId: loanForm.userId,
            kind: loanForm.kind === "advance" ? "advance" : "loan",
            principal: Number(loanForm.principal),
            monthlyDeduction: Number(loanForm.monthlyDeduction),
            description: loanForm.description,
          },
        });
        setNotice("Loan/advance recorded. It will be recovered automatically in the next payroll run.");
      } else if (loanModal) {
        await api(`/api/staff-loans/${loanModal.id}`, {
          method: "PATCH",
          json: {
            monthlyDeduction: Number(loanForm.monthlyDeduction),
            description: loanForm.description,
            active: loanModal.active,
          },
        });
        setNotice("Loan updated.");
      }
      setLoanModal(null);
      await load();
    } catch (err) {
      setLoanError(err instanceof Error ? err.message : "Failed to save loan");
    } finally {
      setLoanBusy(false);
    }
  }
  async function toggleLoanActive(l: StaffLoanRow) {
    try {
      await api(`/api/staff-loans/${l.id}`, { method: "PATCH", json: { active: !l.active } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update loan");
    }
  }
  async function deleteLoan() {
    const l = deletingLoan;
    if (!l) return;
    setLoanBusy(true);
    try {
      await api(`/api/staff-loans/${l.id}`, { method: "DELETE" });
      setDeletingLoan(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete loan");
    } finally {
      setLoanBusy(false);
    }
  }

  // ---- attendance ----
  async function logAttendance(e: FormEvent) {
    e.preventDefault();
    setAttBusy(true);
    setError(null);
    try {
      await api("/api/casual-attendance", {
        method: "POST",
        json: { casualId: attForm.casualId, date: attForm.date, days: Number(attForm.days) || 1, note: attForm.note },
      });
      setNotice("Attendance logged.");
      setAttForm((p) => ({ ...p, note: "" }));
      await loadAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log attendance");
    } finally {
      setAttBusy(false);
    }
  }

  async function prefillFromAttendance() {
    try {
      const at = await api<{ records: AttendanceRow[]; summary: Record<string, number> | null }>(
        `/api/casual-attendance?month=${month}&year=${year}`
      );
      const summary = at.summary ?? {};
      const next: Record<string, string> = {};
      for (const c of casualsEligible) {
        if (summary[c.id]) next[c.id] = String(summary[c.id]);
      }
      setCasualDays((p) => ({ ...p, ...next }));
      setNotice("Days worked pre-filled from the attendance log for this month.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance summary");
    }
  }

  async function prefillOvertimeFromAttendance() {
    try {
      const at = await api<{ summary: Array<{ user_id: string; overtime_hours: number }> | null }>(
        `/api/attendance?month=${month}&year=${year}`
      );
      const next: Record<string, string> = {};
      for (const s of at.summary ?? []) {
        if (s.overtime_hours > 0) next[s.user_id] = String(s.overtime_hours);
      }
      setOtHours((p) => ({ ...p, ...next }));
      setNotice("Overtime hours pre-filled from the attendance log for this month.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance");
    }
  }

  async function prefillEncashment() {
    try {
      const data = await api<{ encashments: Array<{ id: string; user_id: string; name: string; days: number }> }>(
        `/api/leave-encashments?year=${year}`
      );
      const next = { ...leavePayouts };
      const ids: string[] = [];
      const userIds: Record<string, string> = {};
      for (const e of data.encashments) {
        const emp = employees.find((x) => x.id === e.user_id);
        const dailyRate = emp?.basic_salary ? emp.basic_salary / 26 : 0;
        next[e.user_id] = String(Math.round(e.days * dailyRate * 100) / 100);
        ids.push(e.id);
        userIds[e.id] = e.user_id;
      }
      setLeavePayouts(next);
      setEncashmentIds(ids);
      setEncashmentUserIds(userIds);
      setEncashmentYear(year);
      setNotice(
        ids.length === 0
          ? `No unpaid leave encashment found for ${year}.`
          : `Leave encashment pre-filled for ${ids.length} employee(s) from ${year}. Only rows for selected staff are marked paid.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load encashments");
    }
  }

  const estimate =
    eligible
      .filter((e) => selected[e.id])
      .reduce(
        (s, e) =>
          s +
          (e.basic_salary ?? 0) +
          (Number(allowances[e.id]) || 0) +
          (Number(perDiem[e.id]) || 0) +
          (Number(otHours[e.id]) || 0) * (Number(otRate[e.id]) || 0) +
          (Number(bonuses[e.id]) || 0) +
          (Number(leavePayouts[e.id]) || 0),
        0
      ) + casualsEligible.filter((c) => casualSelected[c.id]).reduce((s, c) => s + casualGross(c), 0);

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Process monthly salaries and casual wages with automatic Kenyan statutory deductions, per diem, overtime, bonuses, staff loans and other deductions."
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      <div className="card mb-6 p-5">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Run payroll for a month</h2>
        <p className="mb-4 text-xs text-slate-500">
          Statutory deductions are computed automatically:{" "}
          <strong>PAYE</strong>
          <HelpTip text="Pay As You Earn — income tax deducted from each salary and remitted to KRA." />{" "}
          <strong>NSSF</strong>
          <HelpTip text="National Social Security Fund — Tier I & Tier II pension contributions." />{" "}
          <strong>SHIF</strong>
          <HelpTip text="Social Health Insurance Fund — 2.75% of gross, minimum KSh 300." />{" "}
          <strong>Housing Levy</strong>
          <HelpTip text="Affordable Housing Levy — 1.5% of gross pay." />{" "}
          <strong>HELB</strong>
          <HelpTip text="Higher Education Loans Board — deducted only for employees with a HELB loan." />{" "}
          <strong>Per diem</strong>
          <HelpTip text="Reimbursement for travel/meals. Added to take-home pay but not taxed or subject to statutory deductions." />
        </p>
        <form onSubmit={requestRun} className="space-y-6">
          {(costCentres.length > 0 || projects.length > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pr-cc">Cost centre (optional — tags the salary expense)</label>
                <select id="pr-cc" className="input" value={costCentre} onChange={(e) => setCostCentre(e.target.value)}>
                  <option value="">— none —</option>
                  {costCentres.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="pr-prj">Project (optional)</label>
                <select id="pr-prj" className="input" value={project} onChange={(e) => setProject(e.target.value)}>
                  <option value="">— none —</option>
                  {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="label" htmlFor="pr-month">Month</label>
              <select id="pr-month" className="input" value={month} onChange={(e) => { setMonth(Number(e.target.value)); }}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pr-year">Year</label>
              <input
                id="pr-year"
                type="number"
                className={inputCls(errors.year)}
                value={year}
                min={2000}
                max={2100}
                onChange={(e) => { setYear(Number(e.target.value)); clearError("year"); }}
              />
              <FieldError msg={errors.year} />
            </div>
            <button type="button" className="btn-secondary mt-5 px-3 py-1.5 text-sm" onClick={prefillFromAttendance}>
              Prefill casual days from attendance
            </button>
            <button type="button" className="btn-secondary mt-5 px-3 py-1.5 text-sm" onClick={prefillOvertimeFromAttendance}>
              Prefill overtime from attendance
            </button>
            <button type="button" className="btn-secondary mt-5 px-3 py-1.5 text-sm" onClick={prefillEncashment}>
              Prefill leave encashment
            </button>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Employees</h3>
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
                    <th>Basic</th>
                    <th>Allowance</th>
                    <th>Per diem</th>
                    <th>OT hrs</th>
                    <th>OT rate</th>
                    <th>Bonus</th>
                    <th>Other ded.</th>
                    <th>Leave</th>
                  </tr>
                </thead>
                <tbody>
                  {eligible.map((e) => (
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
                      <td className="whitespace-nowrap">{e.basic_salary !== null ? fmt(e.basic_salary) : "—"}</td>
                      <td><input type="number" min={0} className="input w-24 py-1 text-xs" placeholder="0" value={allowances[e.id] ?? ""} onChange={(ev) => setAllowances((p) => ({ ...p, [e.id]: ev.target.value }))} /></td>
                      <td><input type="number" min={0} className="input w-24 py-1 text-xs" placeholder="0" value={perDiem[e.id] ?? ""} onChange={(ev) => setPerDiem((p) => ({ ...p, [e.id]: ev.target.value }))} /></td>
                      <td><input type="number" min={0} step="0.5" className="input w-16 py-1 text-xs" placeholder="0" value={otHours[e.id] ?? ""} onChange={(ev) => setOtHours((p) => ({ ...p, [e.id]: ev.target.value }))} /></td>
                      <td><input type="number" min={0} className="input w-20 py-1 text-xs" placeholder="0" value={otRate[e.id] ?? ""} onChange={(ev) => setOtRate((p) => ({ ...p, [e.id]: ev.target.value }))} /></td>
                      <td><input type="number" min={0} className="input w-24 py-1 text-xs" placeholder="0" value={bonuses[e.id] ?? ""} onChange={(ev) => setBonuses((p) => ({ ...p, [e.id]: ev.target.value }))} /></td>
                      <td><input type="number" min={0} className="input w-24 py-1 text-xs" placeholder="0" value={otherDed[e.id] ?? ""} onChange={(ev) => setOtherDed((p) => ({ ...p, [e.id]: ev.target.value }))} /></td>
                      <td><input type="number" min={0} className="input w-24 py-1 text-xs" placeholder="0" value={leavePayouts[e.id] ?? ""} onChange={(ev) => setLeavePayouts((p) => ({ ...p, [e.id]: ev.target.value }))} /></td>
                    </tr>
                  ))}
                  {eligible.length === 0 && (
                    <tr><td colSpan={10} className="py-6 text-center text-sm text-slate-500">
                      No employees with a basic salary set yet. Set salaries on the Team page first.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Casual workers</h3>
              <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={openNewCasual}>+ Add casual</button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="w-12">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={allCasualsSelected} onChange={toggleAllCasuals} className="h-4 w-4 accent-indigo-600" />
                      </label>
                    </th>
                    <th>Casual</th>
                    <th>Daily rate</th>
                    <th>Days worked</th>
                    <th>Statutory</th>
                    <th>Per diem</th>
                    <th className="text-right">Gross (est.)</th>
                  </tr>
                </thead>
                <tbody>
                  {casualsEligible.map((c) => (
                    <tr key={c.id} className={casualSelected[c.id] ? "bg-indigo-50/60" : ""}>
                      <td>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input type="checkbox" checked={!!casualSelected[c.id]} onChange={() => toggleCasual(c.id)} className="h-4 w-4 accent-indigo-600" />
                        </label>
                      </td>
                      <td className="font-medium">{c.name}</td>
                      <td>{fmt(c.dailyRate)}</td>
                      <td><input type="number" min={0} step="0.5" className="input w-24 py-1 text-xs" placeholder="0" value={casualDays[c.id] ?? ""} onChange={(ev) => setCasualDays((p) => ({ ...p, [c.id]: ev.target.value }))} /></td>
                      <td>
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                          <input type="checkbox" checked={casualStatutory[c.id] ?? true} onChange={(ev) => setCasualStatutory((p) => ({ ...p, [c.id]: ev.target.checked }))} className="h-4 w-4 accent-indigo-600" />
                          Apply
                        </label>
                      </td>
                      <td><input type="number" min={0} className="input w-24 py-1 text-xs" placeholder="0" value={casualPerDiem[c.id] ?? ""} onChange={(ev) => setCasualPerDiem((p) => ({ ...p, [c.id]: ev.target.value }))} /></td>
                      <td className="text-right">{fmt(casualGross(c))}</td>
                    </tr>
                  ))}
                  {casualsEligible.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-sm text-slate-500">No active casual workers. Click “Add casual” to register one.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="text-sm text-slate-600">
              <span className="font-medium">{selectedCount}</span> of {eligible.length + casualsEligible.length} payee(s) selected
              <FieldError msg={errors.selected} />
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Processing…" : `Process payroll (${selectedCount})`}
            </button>
          </div>
        </form>
      </div>

      {/* Casual workers */}
      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-600">Casual workers</h2>
            <p className="mt-1 text-xs text-slate-500">Register daily-rate workers, then log their attendance or enter days in the run.</p>
          </div>
          <button className="btn-secondary px-3 py-1.5 text-sm" onClick={openNewCasual}>+ Add casual</button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="table-base">
            <thead><tr><th>Name</th><th>ID number</th><th>Phone</th><th className="text-right">Daily rate</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {casuals.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.idNumber ?? "—"}</td>
                  <td>{c.phone ?? "—"}</td>
                  <td className="text-right">{fmt(c.dailyRate)}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{c.active ? "Active" : "Inactive"}</span></td>
                  <td className="whitespace-nowrap text-right">
                    <button onClick={() => openEditCasual(c)} className="btn-secondary px-2 py-1 text-xs">Edit</button>
                    <button onClick={() => setDeletingCasual(c)} className="btn-danger ml-1 px-2 py-1 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {casuals.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">No casual workers registered yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Casual attendance */}
      <div className="card mb-6 p-5">
        <h2 className="text-sm font-semibold text-slate-600">Casual attendance — {MONTHS[month - 1]} {year}</h2>
        <p className="mt-1 text-xs text-slate-500">Log days worked and use “Prefill casual days from attendance” in the run above.</p>
        <form onSubmit={logAttendance} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Casual</label>
            <select className="input" value={attForm.casualId} onChange={(e) => setAttForm((p) => ({ ...p, casualId: e.target.value }))} required>
              <option value="">Select…</option>
              {casualsEligible.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Date</label><input type="date" className="input" value={attForm.date} onChange={(e) => setAttForm((p) => ({ ...p, date: e.target.value }))} required /></div>
          <div><label className="label">Days</label><input type="number" min={0.5} step="0.5" className="input w-24" value={attForm.days} onChange={(e) => setAttForm((p) => ({ ...p, days: e.target.value }))} /></div>
          <div className="min-w-[12rem] flex-1"><label className="label">Note</label><input className="input" value={attForm.note} onChange={(e) => setAttForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional" /></div>
          <button type="submit" className="btn-primary" disabled={attBusy}>{attBusy ? "Saving…" : "Log attendance"}</button>
          <button type="button" className="btn-secondary" onClick={loadAttendance}>Refresh</button>
        </form>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="table-base">
            <thead><tr><th>Date</th><th>Casual</th><th className="text-right">Days</th><th>Note</th></tr></thead>
            <tbody>
              {attendance.map((a) => (
                <tr key={a.id}><td>{a.date}</td><td>{a.casualName}</td><td className="text-right">{a.days}</td><td>{a.note ?? "—"}</td></tr>
              ))}
              {attendance.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-sm text-slate-500">No attendance logged for this month.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff loans */}
      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-600">Staff loans &amp; advances</h2>
            <p className="mt-1 text-xs text-slate-500">Recovered automatically from each payroll run until the balance clears.</p>
          </div>
          <button className="btn-secondary px-3 py-1.5 text-sm" onClick={openNewLoan}>+ Add loan / advance</button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="table-base">
            <thead><tr><th>Employee</th><th>Type</th><th className="text-right">Amount</th><th className="text-right">Balance</th><th className="text-right">Monthly</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium">{l.userName}</td>
                  <td className="capitalize">{l.kind}</td>
                  <td className="text-right">{fmt(l.principal)}</td>
                  <td className="text-right">{fmt(l.balance)}</td>
                  <td className="text-right">{fmt(l.monthlyDeduction)}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${l.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{l.active ? "Active" : "Closed"}</span></td>
                  <td className="whitespace-nowrap text-right">
                    <button onClick={() => openEditLoan(l)} className="btn-secondary px-2 py-1 text-xs">Edit</button>
                    <button onClick={() => toggleLoanActive(l)} className="btn-secondary ml-1 px-2 py-1 text-xs">{l.active ? "Stop" : "Resume"}</button>
                    <button onClick={() => setDeletingLoan(l)} className="btn-danger ml-1 px-2 py-1 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {loans.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-sm text-slate-500">No staff loans or advances.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payroll history */}
      <div className="card overflow-x-auto">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Payroll history</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Period</th>
              <th className="text-right">Payslips</th>
              <th className="text-right">Gross</th>
              <th className="text-right">Net</th>
              <th>Status</th>
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
                <td>{r.paid ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Paid</span> : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Unpaid</span>}</td>
                <td className="text-slate-500">{r.created_at}</td>
                <td className="whitespace-nowrap text-right">
                  <button onClick={() => (openRun === r.id ? setOpenRun(null) : showRun(r.id))} className="btn-secondary btn-xs">{openRun === r.id ? "Hide" : "View"}</button>
                  <button onClick={() => openEdit(r)} className="btn-secondary ml-1 px-2 py-1 text-xs">Edit</button>
                  <button onClick={() => markPaid(r, !r.paid)} className="btn-secondary ml-1 px-2 py-1 text-xs">{r.paid ? "Unmark" : "Mark paid"}</button>
                  <button onClick={() => setDeletingRun(r)} className="btn-danger ml-1 px-2 py-1 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-sm text-slate-500">No payroll runs yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* P9 */}
      <div className="card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-600">Annual P9 returns</h2>
            <p className="mt-1 text-xs text-slate-500">Download each employee's Kenya P9 tax deduction card for a selected year.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="label mb-0">Year</label>
            <input type="number" className="input w-28" value={p9Year} min={2000} max={2100} onChange={(e) => setP9Year(Number(e.target.value))} />
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="table-base">
            <thead><tr><th>Employee</th><th>Emp No.</th><th>KRA PIN</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium">{e.name}<span className="ml-2 text-xs text-slate-400 capitalize">{ROLE_LABELS[e.role]}</span></td>
                  <td>{e.employee_number ?? "—"}</td>
                  <td>{e.statutory_number ?? "—"}</td>
                  <td className="whitespace-nowrap text-right"><button onClick={() => window.open(`/p9?year=${p9Year}&userId=${e.id}`, "_blank")} className="btn-secondary btn-xs">Download P9</button></td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-500">No employees yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {openPayslips && openRun && (
        <div className="card mt-6 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-600">Payslips — {runMeta ? MONTHS[runMeta.month - 1] + " " + runMeta.year : ""}</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => window.open(`/api/payroll/${openRun}/export?format=csv`)} className="btn-secondary px-2 py-1 text-xs">Export CSV</button>
              <button onClick={() => window.open(`/api/payroll/${openRun}/export?format=bank`)} className="btn-secondary px-2 py-1 text-xs">Bank file</button>
              <button onClick={() => window.open(`/api/payroll/${openRun}/export?format=mpesa`)} className="btn-secondary px-2 py-1 text-xs">M-Pesa file</button>
              <span className="mx-1 h-5 w-px self-center bg-slate-200" />
              <button onClick={() => window.open(`/api/payroll/${openRun}/returns?type=p10`)} className="btn-secondary px-2 py-1 text-xs">P10</button>
              <button onClick={() => window.open(`/api/payroll/${openRun}/returns?type=nssf`)} className="btn-secondary px-2 py-1 text-xs">NSSF</button>
              <button onClick={() => window.open(`/api/payroll/${openRun}/returns?type=shif`)} className="btn-secondary px-2 py-1 text-xs">SHIF</button>
              <button onClick={() => window.open(`/api/payroll/${openRun}/returns?type=housing`)} className="btn-secondary px-2 py-1 text-xs">Housing</button>
            </div>
          </div>
          <table className="table-base">
            <thead><tr><th>Name</th><th>Type</th><th>Emp No.</th><th className="text-right">Gross</th><th className="text-right">Net</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {openPayslips.map((p) => (
                <tr key={p.userId ?? p.casualId}>
                  <td className="font-medium">{p.name}</td>
                  <td className="capitalize text-slate-500">{p.personType}</td>
                  <td>{p.employeeNumber ?? "—"}</td>
                  <td className="text-right">{fmt(p.grossPay)}</td>
                  <td className="text-right text-emerald-700">{fmt(p.netPay)}</td>
                  <td className="whitespace-nowrap text-right"><button onClick={() => setViewingUser(p)} className="btn-secondary btn-xs">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingUser && openRun && (
        <PayslipModal
          payrollId={openRun}
          userId={viewingUser.userId ?? undefined}
          casualId={viewingUser.casualId ?? undefined}
          label={viewingUser.name}
          onClose={() => setViewingUser(null)}
        />
      )}

      {editRun && editSlips && (
        <Modal title={`Edit payroll — ${MONTHS[editRun.month - 1]} ${editRun.year}`} onClose={() => { setEditRun(null); setEditSlips(null); }}>
          <p className="mb-3 text-sm text-slate-500">Adjust earnings and deductions; payslips are recalculated automatically. Staff-loan recoveries and statutory rates stay as computed at run time.</p>
          <div className="max-h-[50vh] overflow-x-auto">
            <table className="table-base w-full">
              <thead>
                <tr><th>Name</th><th>Basic</th><th>Allow.</th><th>Per diem</th><th>Overtime</th><th>Bonus</th><th>Other ded.</th><th>Leave</th><th>HELB</th><th>Days</th></tr>
              </thead>
              <tbody>
                {editSlips.map((s) => {
                  const key = s.userId ?? s.casualId!;
                  const isCasual = s.personType === "casual";
                  const dis = isCasual ? "disabled:bg-slate-100" : "";
                  return (
                    <tr key={key}>
                      <td className="font-medium">{s.name}{isCasual && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">Casual</span>}</td>
                      <td><input type="number" min={0} disabled={isCasual} className={`input w-20 py-1 text-xs ${dis}`} value={s.basicSalary} onChange={(e) => updateEditSlip(key, "basicSalary", e.target.value)} /></td>
                      <td><input type="number" min={0} disabled={isCasual} className={`input w-20 py-1 text-xs ${dis}`} value={s.allowances} onChange={(e) => updateEditSlip(key, "allowances", e.target.value)} /></td>
                      <td><input type="number" min={0} disabled={isCasual} className={`input w-20 py-1 text-xs ${dis}`} value={s.perDiem} onChange={(e) => updateEditSlip(key, "perDiem", e.target.value)} /></td>
                      <td><input type="number" min={0} disabled={isCasual} className={`input w-20 py-1 text-xs ${dis}`} value={s.overtimePay} onChange={(e) => updateEditSlip(key, "overtimePay", e.target.value)} /></td>
                      <td><input type="number" min={0} disabled={isCasual} className={`input w-20 py-1 text-xs ${dis}`} value={s.bonus} onChange={(e) => updateEditSlip(key, "bonus", e.target.value)} /></td>
                      <td><input type="number" min={0} disabled={isCasual} className={`input w-20 py-1 text-xs ${dis}`} value={s.otherDeductions} onChange={(e) => updateEditSlip(key, "otherDeductions", e.target.value)} /></td>
                      <td><input type="number" min={0} disabled={isCasual} className={`input w-20 py-1 text-xs ${dis}`} value={s.leaveDaysPayout} onChange={(e) => updateEditSlip(key, "leaveDaysPayout", e.target.value)} /></td>
                      <td><input type="number" min={0} disabled={isCasual} className={`input w-20 py-1 text-xs ${dis}`} value={s.helb} onChange={(e) => updateEditSlip(key, "helb", e.target.value)} /></td>
                      <td><input type="number" min={0} step="0.5" disabled={!isCasual} className={`input w-16 py-1 text-xs ${!isCasual ? "disabled:bg-slate-100" : ""}`} value={s.daysWorked ?? 0} onChange={(e) => updateEditSlip(key, "daysWorked", e.target.value)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => { setEditRun(null); setEditSlips(null); }}>Cancel</button>
            <button className="btn-primary" onClick={saveEdit} disabled={busy}>{busy ? "Saving…" : "Save & recalculate"}</button>
          </div>
        </Modal>
      )}

      {casualModal && (
        <Modal title={casualModal === "new" ? "Add casual worker" : "Edit casual worker"} onClose={() => setCasualModal(null)}>
          <form onSubmit={saveCasual} className="space-y-4">
            {casualError && <Alert kind="error">{casualError}</Alert>}
            <div><label className="label">Name</label><input className="input" value={casualForm.name} onChange={(e) => setCasualForm((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">ID number</label><input className="input" value={casualForm.idNumber} onChange={(e) => setCasualForm((p) => ({ ...p, idNumber: e.target.value }))} placeholder="Optional" /></div>
              <div><label className="label">Phone</label><input className="input" value={casualForm.phone} onChange={(e) => setCasualForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <div><label className="label">Daily rate (KSh)</label><input type="number" min={0} className="input" value={casualForm.dailyRate} onChange={(e) => setCasualForm((p) => ({ ...p, dailyRate: e.target.value }))} placeholder="e.g. 800" required /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setCasualModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={casualBusy}>{casualBusy ? "Saving…" : casualModal === "new" ? "Add casual" : "Save changes"}</button>
            </div>
          </form>
        </Modal>
      )}

      {loanModal && (
        <Modal title={loanModal === "new" ? "Add loan / advance" : "Edit loan / advance"} onClose={() => setLoanModal(null)}>
          <form onSubmit={saveLoan} className="space-y-4">
            {loanError && <Alert kind="error">{loanError}</Alert>}
            {loanModal === "new" ? (
              <>
                <div>
                  <label className="label">Employee</label>
                  <select className="input" value={loanForm.userId} onChange={(e) => setLoanForm((p) => ({ ...p, userId: e.target.value }))} required>
                    <option value="">Select…</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={loanForm.kind} onChange={(e) => setLoanForm((p) => ({ ...p, kind: e.target.value }))}>
                    <option value="loan">Loan</option>
                    <option value="advance">Salary advance</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Amount (KSh)</label><input type="number" min={0} className="input" value={loanForm.principal} onChange={(e) => setLoanForm((p) => ({ ...p, principal: e.target.value }))} required /></div>
                  <div><label className="label">Monthly recovery (KSh)</label><input type="number" min={0} className="input" value={loanForm.monthlyDeduction} onChange={(e) => setLoanForm((p) => ({ ...p, monthlyDeduction: e.target.value }))} required /></div>
                </div>
              </>
            ) : (
              <div><label className="label">Monthly recovery (KSh)</label><input type="number" min={0} className="input" value={loanForm.monthlyDeduction} onChange={(e) => setLoanForm((p) => ({ ...p, monthlyDeduction: e.target.value }))} required /></div>
            )}
            <div><label className="label">Description</label><input className="input" value={loanForm.description} onChange={(e) => setLoanForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setLoanModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loanBusy}>{loanBusy ? "Saving…" : loanModal === "new" ? "Add" : "Save changes"}</button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmRun}
        title="Process payroll"
        message={
          <span>
            Process payroll for <strong>{selectedCount}</strong> payee(s) for <strong>{MONTHS[month - 1]} {year}</strong>? This creates permanent payslips, recovers active staff loans, posts to the ledger, and cannot be undone — you can only delete and re-run.
            <span className="mt-2 block text-slate-500">Estimated gross: <strong>{fmt(estimate)}</strong></span>
          </span>
        }
        confirmLabel="Process payroll"
        tone="default"
        busy={busy}
        onConfirm={doRun}
        onCancel={() => setConfirmRun(false)}
      />
      <ConfirmDialog
        open={!!deletingRun}
        title="Delete payroll"
        message={<span>Delete payroll for <strong>{deletingRun ? `${MONTHS[deletingRun.month - 1]} ${deletingRun.year}` : ""}</strong>? Payslips are removed and any staff-loan recoveries are restored.</span>}
        busy={deleteBusy}
        onConfirm={deleteRun}
        onCancel={() => setDeletingRun(null)}
      />
      <ConfirmDialog
        open={!!deletingCasual}
        title="Delete casual worker"
        message={<span>Remove <strong>{deletingCasual?.name}</strong> from your casual roster? Past payslips are kept.</span>}
        busy={casualBusy}
        onConfirm={deleteCasual}
        onCancel={() => setDeletingCasual(null)}
      />
      <ConfirmDialog
        open={!!deletingLoan}
        title="Delete loan / advance"
        message={<span>Delete this {deletingLoan?.kind} for <strong>{deletingLoan?.userName}</strong>? Recoveries stop immediately.</span>}
        busy={loanBusy}
        onConfirm={deleteLoan}
        onCancel={() => setDeletingLoan(null)}
      />
    </>
  );
}

function PayslipModal({
  payrollId,
  userId,
  casualId,
  label,
  onClose,
}: {
  payrollId: string;
  userId?: string;
  casualId?: string;
  label: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PayslipDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const qs = casualId ? `?casualId=${casualId}` : userId ? `?userId=${userId}` : "";
  useEffect(() => {
    api<PayslipDetail>(`/api/payroll/payslip/${payrollId}${qs}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [payrollId, qs]);

  if (err) return <div className="card mt-6 p-5"><Alert kind="error">{err}</Alert></div>;
  if (!data) return <div className="card mt-6 p-5 text-sm text-slate-500">Loading payslip…</div>;

  return (
    <div className="card mt-6">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-600">Payslip — {MONTHS[data.month - 1]} {data.year} · {label}</h2>
        <button onClick={() => window.open(`/payslip/${payrollId}${qs}`, "_blank")} className="btn-primary px-3 py-1 text-xs">Open printable / PDF</button>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
      </div>
      <div className="p-5">
        <p className="mb-2 text-xs text-slate-500">
          {data.personType === "casual" ? "Casual worker" : "Employee"}: {data.name} · Emp No: {data.employeeNumber ?? "—"}
          {data.personType !== "casual" && <> · {ROLE_LABELS[data.role as Role]}</>}
        </p>
        <PayslipLines data={data} />
      </div>
    </div>
  );
}
