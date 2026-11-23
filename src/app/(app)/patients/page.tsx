"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Alert, Modal, ConfirmDialog, StatusBadge, FieldError, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useSession } from "@/components/SessionProvider";
import { formatKes, formatDate } from "@/lib/format";
import { toCsv } from "@/lib/csv";
import type {
  ConsultationPaymentMethod,
  ConsultationRow,
  PatientRow,
} from "@/lib/types";

const PAYMENT_METHODS: { value: ConsultationPaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa / Mobile money" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];

const PAYMENT_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label])
);

const COMMON_PROCEDURES = [
  "General Consultation",
  "Specialist Consultation",
  "Follow-up Visit",
  "Laboratory Test",
  "X-Ray",
  "Ultrasound Scan",
  "Dental Procedure",
  "Physiotherapy",
  "Minor Surgery",
  "Maternity / Antenatal",
  "Vaccination",
  "Pharmacy / Medication",
];

const today = () => new Date().toISOString().slice(0, 10);

function parseAmount(value: string): number {
  return Number(value.replace(/,/g, "")) || 0;
}

function calcAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return "—";
  const dob = new Date(dateOfBirth + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? `${age} yrs` : "—";
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = "\ufeff" + toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ *
 * Patient form
 * ------------------------------------------------------------------ */

interface PatientFormState {
  fullName: string;
  phone: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  notes: string;
}

function emptyPatientForm(): PatientFormState {
  return { fullName: "", phone: "", email: "", gender: "", dateOfBirth: "", address: "", notes: "" };
}

function PatientModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: PatientRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<PatientFormState>(
    initial
      ? {
          fullName: initial.fullName,
          phone: initial.phone ?? "",
          email: initial.email ?? "",
          gender: initial.gender ?? "",
          dateOfBirth: initial.dateOfBirth ?? "",
          address: initial.address ?? "",
          notes: initial.notes ?? "",
        }
      : emptyPatientForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PatientFormState>(key: K, value: PatientFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.fullName.trim().length < 2) {
      setError("Please enter the patient's full name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await api(`/api/patients/${initial.id}`, { method: "PATCH", json: form });
        toast.success("Patient details updated.");
      } else {
        await api("/api/patients", { method: "POST", json: form });
        toast.success("Patient registered.");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the patient");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={initial ? "Edit patient" : "Register new patient"}
      size="lg"
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="label">Full name *</span>
            <input
              className="input"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="e.g. Jane Wanjiku"
              required
            />
          </label>
          <label className="block">
            <span className="label">Phone</span>
            <input
              className="input"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="07XX XXX XXX"
            />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="block">
            <span className="label">Gender</span>
            <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">Select…</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Date of birth</span>
            <input
              className="input"
              type="date"
              max={today()}
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Address</span>
            <input
              className="input"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Notes / allergies</span>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Allergies, chronic conditions or other clinical notes…"
            />
          </label>
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Register patient"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Consultation form
 * ------------------------------------------------------------------ */

function ConsultationModal({
  patients,
  initial,
  onClose,
  onSaved,
}: {
  patients: PatientRow[];
  initial: ConsultationRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<"existing" | "new">(
    initial ? "existing" : patients.length > 0 ? "existing" : "new"
  );
  const [patientId, setPatientId] = useState(initial?.patientId ?? "");
  const [newPatient, setNewPatient] = useState({
    fullName: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
  });
  const [consultationDate, setConsultationDate] = useState(initial?.consultationDate ?? today());
  const [procedureName, setProcedureName] = useState(initial?.procedureName ?? "");
  const [doctorName, setDoctorName] = useState(initial?.doctorName ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [paymentMethod, setPaymentMethod] = useState<ConsultationPaymentMethod>(
    initial?.paymentMethod ?? "cash"
  );
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">(
    initial?.paymentStatus ?? "paid"
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | undefined>();
  const [patientError, setPatientError] = useState<string | undefined>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setAmountError(undefined);
    setPatientError(undefined);

    if (!procedureName.trim()) {
      setError("Please enter the consultation procedure or service.");
      return;
    }
    if (parseAmount(amount) <= 0) {
      setAmountError("Enter an amount greater than zero.");
      return;
    }
    if (!initial && mode === "existing" && !patientId) {
      setPatientError("Select a patient or register a new one.");
      return;
    }
    if (!initial && mode === "new" && newPatient.fullName.trim().length < 2) {
      setPatientError("Enter the new patient's full name.");
      return;
    }

    const payload: Record<string, unknown> = {
      consultationDate,
      procedureName: procedureName.trim(),
      doctorName: doctorName.trim(),
      amount: parseAmount(amount),
      paymentMethod,
      paymentStatus,
      notes: notes.trim(),
    };
    if (!initial) {
      if (mode === "new") payload.newPatient = newPatient;
      else payload.patientId = patientId;
    }

    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await api(`/api/consultations/${initial.id}`, { method: "PATCH", json: payload });
        toast.success("Consultation updated and the ledger re-posted.");
      } else {
        await api("/api/consultations", { method: "POST", json: payload });
        toast.success("Consultation saved and posted to accounting.");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the consultation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={initial ? "Edit consultation" : "New consultation"}
      size="xl"
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {!initial && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("existing");
                setPatientError(undefined);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mode === "existing" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Existing patient
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("new");
                setPatientError(undefined);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mode === "new" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              New patient
            </button>
          </div>
        )}

        {!initial && mode === "new" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block sm:col-span-2">
              <span className="label">Patient full name *</span>
              <input
                className="input"
                value={newPatient.fullName}
                onChange={(e) => setNewPatient({ ...newPatient, fullName: e.target.value })}
                placeholder="e.g. Jane Wanjiku"
              />
            </label>
            <label className="block">
              <span className="label">Phone</span>
              <input
                className="input"
                type="tel"
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                placeholder="07XX XXX XXX"
              />
            </label>
            <label className="block">
              <span className="label">Gender</span>
              <select
                className="input"
                value={newPatient.gender}
                onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
              >
                <option value="">Select…</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Date of birth</span>
              <input
                className="input"
                type="date"
                max={today()}
                value={newPatient.dateOfBirth}
                onChange={(e) => setNewPatient({ ...newPatient, dateOfBirth: e.target.value })}
              />
            </label>
          </div>
        ) : (
          <label className="block">
            <span className="label">Patient *</span>
            <select
              className="input"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              disabled={Boolean(initial)}
            >
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patientNumber} — {p.fullName}
                  {p.phone ? ` (${p.phone})` : ""}
                </option>
              ))}
            </select>
            {patientError && <FieldError msg={patientError} />}
          </label>
        )}
        {!initial && mode === "new" && <FieldError msg={patientError} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="label">Consultation date *</span>
            <input
              className="input"
              type="date"
              value={consultationDate}
              onChange={(e) => setConsultationDate(e.target.value)}
              required
            />
          </label>
          <label className="block lg:col-span-2">
            <span className="label">Procedure / service *</span>
            <input
              className="input"
              list="patient-procedure-options"
              value={procedureName}
              onChange={(e) => setProcedureName(e.target.value)}
              placeholder="e.g. General Consultation"
              required
            />
            <datalist id="patient-procedure-options">
              {COMMON_PROCEDURES.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="label">Attending doctor</span>
            <input
              className="input"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="block">
            <span className="label">Amount (KES) *</span>
            <input
              className={amountError ? "input input-invalid" : "input"}
              type="number"
              min="1"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountError(undefined);
              }}
              placeholder="0.00"
            />
            <FieldError msg={amountError} />
          </label>
          <label className="block">
            <span className="label">Payment method</span>
            <select
              className="input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as ConsultationPaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Payment status</span>
            <select
              className="input"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as "paid" | "unpaid")}
            >
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid / bill later</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="label">Notes / diagnosis</span>
          <textarea
            className="input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Clinical notes, prescription or follow-up instructions…"
          />
        </label>

        <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          {initial
            ? "Saving reverses the old accounting entry and posts the corrected fee."
            : "The fee posts to the accounting ledger automatically. Unpaid visits post to accounts receivable."}
        </p>

        {error && <Alert kind="error">{error}</Alert>}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? "Saving…"
              : initial
              ? "Update consultation"
              : "Save & post to accounting"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

type Tab = "consultations" | "patients";

type DeleteTarget =
  | { kind: "consultation"; row: ConsultationRow }
  | { kind: "patient"; row: PatientRow }
  | null;

export default function PatientsPage() {
  const session = useSession();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("consultations");
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [patientFilter, setPatientFilter] = useState("");

  const [consultationOpen, setConsultationOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<ConsultationRow | null>(null);
  const [patientOpen, setPatientOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = session.role === "admin" || session.role === "secretary";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([
        api<{ patients: PatientRow[] }>("/api/patients"),
        api<{ consultations: ConsultationRow[] }>("/api/consultations"),
      ]);
      setPatients(p.patients ?? []);
      setConsultations(c.consultations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load patient records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const billed = consultations.reduce((sum, c) => sum + c.amount, 0);
    const collected = consultations
      .filter((c) => c.paymentStatus === "paid")
      .reduce((sum, c) => sum + c.amount, 0);
    const month = today().slice(0, 7);
    const thisMonth = consultations.filter((c) => c.consultationDate.slice(0, 7) === month).length;
    return {
      patients: patients.length,
      consultations: consultations.length,
      thisMonth,
      billed,
      collected,
      outstanding: billed - collected,
    };
  }, [patients, consultations]);

  const patientTotals = useMemo(() => {
    const map = new Map<string, { billed: number; outstanding: number; visits: number }>();
    for (const c of consultations) {
      const row = map.get(c.patientId) ?? { billed: 0, outstanding: 0, visits: 0 };
      row.billed += c.amount;
      row.visits += 1;
      if (c.paymentStatus !== "paid") row.outstanding += c.amount;
      map.set(c.patientId, row);
    }
    return map;
  }, [consultations]);

  const filteredConsultations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return consultations.filter((c) => {
      const matchesSearch =
        !term ||
        [c.patientName, c.patientNumber, c.procedureName, c.doctorName ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesStatus = statusFilter === "all" || c.paymentStatus === statusFilter;
      const matchesPatient = !patientFilter || c.patientId === patientFilter;
      const matchesFrom = !fromDate || c.consultationDate >= fromDate;
      const matchesTo = !toDate || c.consultationDate <= toDate;
      return matchesSearch && matchesStatus && matchesPatient && matchesFrom && matchesTo;
    });
  }, [consultations, search, statusFilter, patientFilter, fromDate, toDate]);

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((p) =>
      [p.fullName, p.patientNumber, p.phone ?? "", p.email ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [patients, search]);

  const selectedPatient = patients.find((p) => p.id === patientFilter) ?? null;

  function showPatientHistory(patientId: string) {
    setPatientFilter(patientId);
    setSearch("");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
    setTab("consultations");
  }

  function exportConsultations() {
    downloadCsv(`patient-consultations-${today()}.csv`, [
      [
        "Date",
        "Patient number",
        "Patient name",
        "Procedure",
        "Doctor",
        "Amount",
        "Payment status",
        "Payment method",
        "Notes",
      ],
      ...filteredConsultations.map((c) => [
        c.consultationDate,
        c.patientNumber,
        c.patientName,
        c.procedureName,
        c.doctorName ?? "",
        c.amount.toFixed(2),
        c.paymentStatus,
        PAYMENT_LABELS[c.paymentMethod] ?? c.paymentMethod,
        (c.notes ?? "").replace(/\r?\n/g, " "),
      ]),
    ]);
  }

  function exportPatients() {
    downloadCsv(`patients-${today()}.csv`, [
      ["Patient number", "Name", "Phone", "Email", "Gender", "Date of birth", "Visits", "Billed", "Outstanding", "Notes"],
      ...filteredPatients.map((p) => {
        const totals = patientTotals.get(p.id) ?? { billed: 0, outstanding: 0, visits: 0 };
        return [
          p.patientNumber,
          p.fullName,
          p.phone ?? "",
          p.email ?? "",
          p.gender ?? "",
          p.dateOfBirth ?? "",
          totals.visits,
          totals.billed.toFixed(2),
          totals.outstanding.toFixed(2),
          (p.notes ?? "").replace(/\r?\n/g, " "),
        ];
      }),
    ]);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "consultation") {
        await api(`/api/consultations/${deleteTarget.row.id}`, { method: "DELETE" });
        toast.success("Consultation deleted and the accounting entry reversed.");
      } else {
        await api(`/api/patients/${deleteTarget.row.id}`, { method: "DELETE" });
        toast.success("Patient and related records deleted.");
      }
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the record");
    } finally {
      setDeleting(false);
    }
  }

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setPatientFilter("");
    setStatusFilter("all");
  };

  return (
    <>
      <PageHeader
        title="Patient Consultations"
        subtitle="Register patients, record procedures and fees. Every fee posts to the accounting ledger automatically."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditingPatient(null);
                setPatientOpen(true);
              }}
            >
              Register patient
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditingConsultation(null);
                setConsultationOpen(true);
              }}
            >
              New consultation
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="card mb-6 flex flex-wrap items-center gap-3 border-indigo-100 bg-indigo-50/60 p-4">
        <span className="text-xl" aria-hidden="true">📒</span>
        <div className="min-w-[16rem] flex-1">
          <p className="text-sm font-semibold text-indigo-900">Linked to accounting</p>
          <p className="text-xs text-indigo-700">
            Paid visits debit cash / bank / M-Pesa; unpaid visits debit accounts receivable. Edits and
            deletions reverse and re-post automatically.
          </p>
        </div>
        <Link
          href="/accounting"
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
        >
          Open accounting →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Registered patients</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">{stats.patients}</p>
          <p className="mt-1 text-xs text-slate-400">Total patient records</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Consultations this month</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">{stats.thisMonth}</p>
          <p className="mt-1 text-xs text-slate-400">{stats.consultations} all time</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total billed</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">{formatKes(stats.billed)}</p>
          <p className="mt-1 text-xs text-slate-400">All consultations</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Collected</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-600">{formatKes(stats.collected)}</p>
          <p className="mt-1 text-xs text-slate-400">Marked as paid</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Outstanding</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{formatKes(stats.outstanding)}</p>
          <p className="mt-1 text-xs text-slate-400">Unpaid consultations</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("consultations")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "consultations"
              ? "bg-slate-900 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          Consultations <span className="ml-1 text-xs opacity-80">({consultations.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("patients")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "patients"
              ? "bg-slate-900 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          Patients <span className="ml-1 text-xs opacity-80">({patients.length})</span>
        </button>
      </div>

      <div className="card mt-4 flex flex-wrap items-end gap-3 p-4">
        <label className="block min-w-[14rem] flex-1">
          <span className="label">Search</span>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "consultations"
                ? "Patient, procedure or doctor…"
                : "Name, number, phone or email…"
            }
          />
        </label>

        {tab === "consultations" && (
          <>
            <label className="block">
              <span className="label">Payment</span>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </label>
            <label className="block">
              <span className="label">From</span>
              <input
                type="date"
                className="input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="label">To</span>
              <input
                type="date"
                className="input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
            {(fromDate || toDate || patientFilter || statusFilter !== "all") && (
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </>
        )}

        <button
          type="button"
          className="btn-secondary ml-auto"
          onClick={tab === "consultations" ? exportConsultations : exportPatients}
          disabled={
            tab === "consultations" ? filteredConsultations.length === 0 : filteredPatients.length === 0
          }
        >
          Export CSV
        </button>
      </div>

      {selectedPatient && tab === "consultations" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          <span>
            Showing history for <strong>{selectedPatient.fullName}</strong> ({selectedPatient.patientNumber})
          </span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setPatientFilter("")}>
            Clear
          </button>
        </div>
      )}

      <div className="card mt-4 overflow-x-auto">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : tab === "consultations" ? (
          filteredConsultations.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-sm text-slate-400">No consultations found.</p>
              <button
                type="button"
                className="btn-primary mt-4"
                onClick={() => {
                  setEditingConsultation(null);
                  setConsultationOpen(true);
                }}
              >
                Record first consultation
              </button>
            </div>
          ) : (
            <table className="table-base min-w-[880px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Procedure</th>
                  <th>Doctor</th>
                  <th className="text-right">Amount</th>
                  <th>Payment</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredConsultations.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap text-slate-500">{formatDate(c.consultationDate)}</td>
                    <td>
                      <button
                        type="button"
                        className="font-semibold text-indigo-600 hover:underline"
                        onClick={() => showPatientHistory(c.patientId)}
                      >
                        {c.patientName}
                      </button>
                      <p className="text-xs text-slate-400">{c.patientNumber}</p>
                    </td>
                    <td>
                      <p className="font-medium text-slate-800">{c.procedureName}</p>
                      {c.notes && <p className="max-w-xs text-xs text-slate-400">{c.notes}</p>}
                    </td>
                    <td className="text-slate-600">{c.doctorName || "—"}</td>
                    <td className="whitespace-nowrap text-right font-semibold text-slate-800">
                      {formatKes(c.amount)}
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusBadge status={c.paymentStatus} />
                      <p className="mt-1 text-xs text-slate-400">
                        {PAYMENT_LABELS[c.paymentMethod] ?? c.paymentMethod}
                      </p>
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => {
                            setEditingConsultation(c);
                            setConsultationOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            onClick={() => setDeleteTarget({ kind: "consultation", row: c })}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : filteredPatients.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm text-slate-400">No patients registered yet.</p>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => {
                setEditingPatient(null);
                setPatientOpen(true);
              }}
            >
              Register first patient
            </button>
          </div>
        ) : (
          <table className="table-base min-w-[900px]">
            <thead>
              <tr>
                <th>Patient no.</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Age / gender</th>
                <th className="text-right">Visits</th>
                <th className="text-right">Billed</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((p) => {
                const totals = patientTotals.get(p.id) ?? { billed: 0, outstanding: 0, visits: 0 };
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap font-mono text-xs text-slate-500">{p.patientNumber}</td>
                    <td>
                      <button
                        type="button"
                        className="font-semibold text-indigo-600 hover:underline"
                        onClick={() => showPatientHistory(p.id)}
                      >
                        {p.fullName}
                      </button>
                      {p.notes && <p className="max-w-xs text-xs text-slate-400">{p.notes}</p>}
                    </td>
                    <td className="whitespace-nowrap text-slate-600">
                      {p.phone || p.email || "—"}
                    </td>
                    <td className="whitespace-nowrap text-slate-600">
                      {calcAge(p.dateOfBirth)}
                      {p.gender ? ` / ${p.gender}` : ""}
                    </td>
                    <td className="text-right text-slate-700">{totals.visits}</td>
                    <td className="whitespace-nowrap text-right text-slate-700">{formatKes(totals.billed)}</td>
                    <td className="whitespace-nowrap text-right">
                      {totals.outstanding > 0 ? (
                        <span className="font-semibold text-amber-600">{formatKes(totals.outstanding)}</span>
                      ) : (
                        <span className="text-emerald-600">Clear</span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => showPatientHistory(p.id)}
                        >
                          History
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => {
                            setEditingPatient(p);
                            setPatientOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            onClick={() => setDeleteTarget({ kind: "patient", row: p })}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Fees are recognised in the accounting ledger on the consultation date. Mark a visit as unpaid
        to track it as outstanding, then edit it to paid once settled.
      </p>

      {consultationOpen && (
        <ConsultationModal
          patients={patients}
          initial={editingConsultation}
          onClose={() => {
            setConsultationOpen(false);
            setEditingConsultation(null);
          }}
          onSaved={() => {
            setConsultationOpen(false);
            setEditingConsultation(null);
            load();
          }}
        />
      )}

      {patientOpen && (
        <PatientModal
          initial={editingPatient}
          onClose={() => {
            setPatientOpen(false);
            setEditingPatient(null);
          }}
          onSaved={() => {
            setPatientOpen(false);
            setEditingPatient(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === "patient" ? "Delete patient" : "Delete consultation"}
        message={
          deleteTarget?.kind === "patient" ? (
            <>
              Delete <strong>{deleteTarget.row.fullName}</strong>? This also deletes their consultation
              history and reverses the linked accounting entries.
            </>
          ) : (
            <>
              Delete this {deleteTarget?.kind === "consultation" ? deleteTarget.row.procedureName : ""} record
              for <strong>{deleteTarget?.kind === "consultation" ? deleteTarget.row.patientName : ""}</strong>?
              The linked accounting entry will be reversed.
            </>
          )
        }
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
