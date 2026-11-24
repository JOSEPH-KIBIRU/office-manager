"use client";

import { useMemo, useState } from "react";
import { OrgHeader, OrgFooter, type OrgBrandingData } from "@/components/OrgBranding";
import { printDocument } from "@/lib/print";
import { toCsv, htmlCell } from "@/lib/csv";
import { formatAge, formatDate, formatKes, patientAge } from "@/lib/format";
import type { ConsultationRow, PatientRow } from "@/lib/types";

type ReportType = "patient-register" | "consultation-register" | "patient-statement";

const REPORT_LABELS: Record<ReportType, string> = {
  "patient-register": "Patient register",
  "consultation-register": "Consultation register",
  "patient-statement": "Patient statement",
};

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "all", label: "All methods" },
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa / Mobile money" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}


function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toExcelHtml(title: string, headers: string[], rows: string[][]) {
  const trs = rows
    .map((r) => `<tr>${r.map((c) => `<td>${htmlCell(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<html><head><meta charset="utf-8"></head><body><h3>${htmlCell(title)}</h3><table border="1">${headers
    .map((h) => `<th>${htmlCell(h)}</th>`)
    .join("")}${trs}</table></body></html>`;
}

export default function PatientsReportPanel({
  patients,
  consultations,
  org,
}: {
  patients: PatientRow[];
  consultations: ConsultationRow[];
  org: OrgBrandingData | null;
}) {
  const [type, setType] = useState<ReportType>("patient-register");
  const [patientId, setPatientId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");

  const selectedPatient = patients.find((p) => p.id === patientId) ?? null;

  const patientTotals = useMemo(() => {
    const map = new Map<string, { billed: number; collected: number; outstanding: number; visits: number }>();
    for (const c of consultations) {
      const row = map.get(c.patientId) ?? { billed: 0, collected: 0, outstanding: 0, visits: 0 };
      row.billed += c.amount;
      row.visits += 1;
      if (c.paymentStatus === "paid") row.collected += c.amount;
      else row.outstanding += c.amount;
      map.set(c.patientId, row);
    }
    return map;
  }, [consultations]);

  const filteredConsultations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return consultations.filter((c) => {
      const matchesPatient = !patientId || c.patientId === patientId;
      const matchesFrom = !from || c.consultationDate >= from;
      const matchesTo = !to || c.consultationDate <= to;
      const matchesStatus = status === "all" || c.paymentStatus === status;
      const matchesMethod = method === "all" || c.paymentMethod === method;
      const matchesSearch =
        !term ||
        [c.patientName, c.patientNumber, c.procedureName, c.doctorName ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesPatient && matchesFrom && matchesTo && matchesStatus && matchesMethod && matchesSearch;
    });
  }, [consultations, patientId, from, to, status, method, search]);

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return patients.filter((p) => {
      if (!term) return true;
      return [p.fullName, p.patientNumber, p.phone ?? "", p.email ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [patients, search]);

  const statementRows = useMemo(
    () => (selectedPatient ? filteredConsultations.filter((c) => c.patientId === selectedPatient.id) : []),
    [filteredConsultations, selectedPatient]
  );

  const totals = useMemo(() => {
    if (type === "patient-register") {
      let billed = 0;
      let collected = 0;
      let outstanding = 0;
      for (const p of filteredPatients) {
        const t = patientTotals.get(p.id) ?? { billed: 0, collected: 0, outstanding: 0, visits: 0 };
        billed += t.billed;
        collected += t.collected;
        outstanding += t.outstanding;
      }
      return { billed, collected, outstanding, count: filteredPatients.length };
    }
    const rows = type === "patient-statement" ? statementRows : filteredConsultations;
    let billed = 0;
    let paid = 0;
    for (const c of rows) {
      billed += c.amount;
      if (c.paymentStatus === "paid") paid += c.amount;
    }
    return { billed, paid, outstanding: billed - paid, count: rows.length };
  }, [type, filteredPatients, patientTotals, statementRows, filteredConsultations]);

  const title = type === "patient-statement" && selectedPatient
    ? `Patient statement — ${selectedPatient.fullName}`
    : REPORT_LABELS[type];

  const filterSummary = [
    type === "patient-statement" && selectedPatient
      ? `${selectedPatient.patientNumber} · ${selectedPatient.fullName}`
      : null,
    from || to ? `${from || "start"} to ${to || "today"}` : "All dates",
    status === "all" ? null : `Payment ${status}`,
    method === "all" ? null : PAYMENT_METHODS.find((m) => m.value === method)?.label,
    search ? `Search "${search}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function buildTable(): { headers: string[]; rows: string[][] } {
    if (type === "patient-register") {
      return {
        headers: [
          "Patient No.",
          "Name",
          "Phone",
          "Email",
          "Gender",
          "Date of Birth",
          "Age",
          "Visits",
          "Billed",
          "Collected",
          "Outstanding",
        ],
        rows: filteredPatients.map((p) => {
          const t = patientTotals.get(p.id) ?? { billed: 0, collected: 0, outstanding: 0, visits: 0 };
          return [
            p.patientNumber,
            p.fullName,
            p.phone ?? "",
            p.email ?? "",
            p.gender ?? "",
            p.dateOfBirth ?? "",
            patientAge(p) !== null ? String(patientAge(p)) : "",
            String(t.visits),
            t.billed.toFixed(2),
            t.collected.toFixed(2),
            t.outstanding.toFixed(2),
          ];
        }),
      };
    }

    const rows = type === "patient-statement" ? statementRows : filteredConsultations;
    return {
      headers: [
        "Date",
        "Patient No.",
        "Patient",
        "Procedure",
        "Doctor",
        "Amount",
        "Payment status",
        "Payment method",
        "Notes",
      ],
      rows: rows.map((c) => [
        c.consultationDate,
        c.patientNumber,
        c.patientName,
        c.procedureName,
        c.doctorName ?? "",
        c.amount.toFixed(2),
        c.paymentStatus,
        c.paymentMethod,
        (c.notes ?? "").replace(/\r?\n/g, " "),
      ]),
    };
  }

  function exportCsv() {
    const { headers, rows } = buildTable();
    triggerDownload(
      `${type}-${today()}.csv`,
      "\ufeff" + toCsv([headers, ...rows]),
      "text/csv;charset=utf-8;"
    );
  }

  function exportExcel() {
    const { headers, rows } = buildTable();
    triggerDownload(
      `${type}-${today()}.xls`,
      toExcelHtml(title, headers, rows),
      "application/vnd.ms-excel;charset=utf-8;"
    );
  }

  const canRun = type !== "patient-statement" || Boolean(selectedPatient);

  return (
    <>
      <div className="no-print card mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="label">Report</span>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as ReportType)}
            >
              <option value="patient-register">Patient register</option>
              <option value="consultation-register">Consultation register</option>
              <option value="patient-statement">Patient statement (history)</option>
            </select>
          </label>

          {type === "patient-statement" && (
            <label className="block">
              <span className="label">Patient</span>
              <select
                className="input"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">Select a patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.patientNumber} — {p.fullName}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="label">From</span>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">To</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>

          {type !== "patient-register" && (
            <>
              <label className="block">
                <span className="label">Payment status</span>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Payment method</span>
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="block xl:col-span-2">
            <span className="label">Search</span>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Patient, number, phone, procedure, doctor…"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {(from || to || status !== "all" || method !== "all" || search) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setFrom("");
                setTo("");
                setStatus("all");
                setMethod("all");
                setSearch("");
              }}
            >
              Clear filters
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!canRun}>
            Export CSV
          </button>
          <button type="button" className="btn-secondary" onClick={exportExcel} disabled={!canRun}>
            Export Excel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => printDocument("/patients")}
            disabled={!canRun}
          >
            🖨 Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="report-print card overflow-x-auto">
        <OrgHeader org={org} showTax periodLabel={title} />
        <div className="border-b border-slate-200 px-5 pb-4">
          <p className="text-sm text-slate-500">
            {filterSummary} · Generated {new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>

        {!canRun ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            Select a patient to generate the statement.
          </p>
        ) : type === "patient-register" ? (
          <table className="table-base">
            <thead>
              <tr>
                <th>Patient No.</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Gender / age</th>
                <th className="text-right">Visits</th>
                <th className="text-right">Billed</th>
                <th className="text-right">Collected</th>
                <th className="text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((p) => {
                const t = patientTotals.get(p.id) ?? { billed: 0, collected: 0, outstanding: 0, visits: 0 };
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.patientNumber}</td>
                    <td className="font-medium text-slate-800">{p.fullName}</td>
                    <td>{p.phone || p.email || "—"}</td>
                    <td>
                      {p.gender || "—"} / {formatAge(p)}
                    </td>
                    <td className="text-right">{t.visits}</td>
                    <td className="text-right">{formatKes(t.billed)}</td>
                    <td className="text-right">{formatKes(t.collected)}</td>
                    <td className={`text-right font-semibold ${t.outstanding > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {formatKes(t.outstanding)}
                    </td>
                  </tr>
                );
              })}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No patients match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : type === "patient-statement" && selectedPatient ? (
          <>
            <div className="grid grid-cols-1 gap-4 border-b border-slate-200 px-5 pb-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</p>
                <p className="mt-1 font-bold text-slate-800">{selectedPatient.fullName}</p>
                <p className="text-slate-500">{selectedPatient.patientNumber}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contact</p>
                <p className="mt-1 text-slate-700">{selectedPatient.phone || "—"}</p>
                <p className="text-slate-500">{selectedPatient.email || ""}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Details</p>
                <p className="mt-1 text-slate-700">
                  {selectedPatient.gender || "—"} · {formatAge(selectedPatient)}
                </p>
                <p className="text-slate-500">{selectedPatient.address || "No address"}</p>
              </div>
              {selectedPatient.notes && (
                <div className="sm:col-span-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                  <p className="mt-1 text-slate-700">{selectedPatient.notes}</p>
                </div>
              )}
            </div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Procedure</th>
                  <th>Doctor</th>
                  <th className="text-right">Amount</th>
                  <th>Payment</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {statementRows.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap">{formatDate(c.consultationDate)}</td>
                    <td className="font-medium text-slate-800">{c.procedureName}</td>
                    <td>{c.doctorName || "—"}</td>
                    <td className="text-right font-semibold">{formatKes(c.amount)}</td>
                    <td className="capitalize">
                      {c.paymentStatus} · {c.paymentMethod.replace("_", " ")}
                    </td>
                    <td className="max-w-xs text-slate-500">{c.notes || "—"}</td>
                  </tr>
                ))}
                {statementRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No visits match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Procedure</th>
                <th>Doctor</th>
                <th className="text-right">Amount</th>
                <th>Payment</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredConsultations.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">{formatDate(c.consultationDate)}</td>
                  <td>
                    <span className="font-medium text-slate-800">{c.patientName}</span>
                    <span className="ml-1 text-xs text-slate-400">{c.patientNumber}</span>
                  </td>
                  <td>{c.procedureName}</td>
                  <td>{c.doctorName || "—"}</td>
                  <td className="text-right font-semibold">{formatKes(c.amount)}</td>
                  <td className="capitalize">
                    {c.paymentStatus} · {c.paymentMethod.replace("_", " ")}
                  </td>
                  <td className="max-w-xs text-slate-500">{c.notes || "—"}</td>
                </tr>
              ))}
              {filteredConsultations.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No consultations match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm">
          <p className="font-semibold text-slate-700">
            {totals.count} record(s) · Billed <span className="text-slate-900">{formatKes(totals.billed)}</span>
          </p>
          <p className="font-semibold text-slate-700">
            {type === "patient-register" ? "Collected" : "Paid"}{" "}
            <span className="text-emerald-700">{formatKes("collected" in totals ? totals.collected : totals.paid)}</span>
            {" · "}Outstanding <span className="text-amber-700">{formatKes(totals.outstanding)}</span>
          </p>
        </div>
        <OrgFooter org={org} text="This is a computer-generated patient report." />
      </div>
    </>
  );
}
