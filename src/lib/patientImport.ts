/**
 * Patient / consultation Excel import normalization.
 *
 * Supports three layouts:
 *   - patients:      one row per patient
 *   - consultations: one row per visit, referencing an existing patient
 *   - combined:      one row per visit, with the patient's details repeated
 *
 * This module is pure (no server-only imports) so the same types/helpers can be
 * used by the API route and the import review UI.
 */

import { toIsoDate } from "./bankImport";

export type PatientImportMode = "patients" | "consultations" | "combined";
export type ImportPaymentMethod =
  | "cash"
  | "mpesa"
  | "card"
  | "bank_transfer"
  | "insurance"
  | "other";
export type ImportPaymentStatus = "paid" | "unpaid";

export interface ParsedPatient {
  key: string;
  row: number;
  patientNumber?: string;
  fullName: string;
  phone?: string;
  email?: string;
  gender?: "male" | "female";
  dateOfBirth?: string;
  address?: string;
  notes?: string;
}

export interface ParsedConsultation {
  key: string;
  row: number;
  patientKey: string;
  patientNumber?: string;
  patientName?: string;
  patientPhone?: string;
  consultationDate: string;
  procedureName: string;
  doctorName?: string;
  amount: number;
  paymentMethod: ImportPaymentMethod;
  paymentStatus: ImportPaymentStatus;
  notes?: string;
}

export interface ImportIssue {
  row: number;
  message: string;
}

export interface ParsedImport {
  mode: PatientImportMode;
  totalRows: number;
  patients: ParsedPatient[];
  consultations: ParsedConsultation[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

const MAX_ISSUES = 200;

const ALIASES: Record<string, string[]> = {
  patientNumber: ["patientno", "patientnumber", "patientid", "patientcode", "no", "id", "fileNo", "fileno"],
  fullName: ["fullname", "patientname", "name", "patient", "customername", "clientname", "names"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "tel", "telephone", "contact"],
  email: ["email", "emailaddress", "mail"],
  gender: ["gender", "sex"],
  dateOfBirth: ["dateofbirth", "dob", "birthdate", "birthday"],
  address: ["address", "location", "residence", "physicaladdress"],
  patientNotes: ["patientnotes", "patientnote", "allergies", "medicalnotes", "history"],
  consultationDate: ["visitdate", "consultationdate", "servicedate", "date", "visit", "transactiondate"],
  procedureName: ["procedure", "procedurename", "procedureservice", "service", "services", "treatment", "item", "description"],
  doctorName: ["doctor", "doctorname", "attendingdoctor", "clinician", "servedby", "provider"],
  amount: ["amount", "fee", "charges", "charge", "cost", "total", "price", "amountpaid"],
  paymentMethod: ["paymentmethod", "method", "modeofpayment", "paymentmode", "paymethod"],
  paymentStatus: ["paymentstatus", "status", "paid", "paymentstate"],
  consultationNotes: ["notes", "consultationnotes", "visitnotes", "diagnosis", "remarks", "comment", "comments"],
};

function normalizeHeader(value: string): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestScore = 0;
  const limit = Math.min(rows.length, 25);
  for (let i = 0; i < limit; i++) {
    let score = 0;
    for (const cell of rows[i] ?? []) {
      const key = normalizeHeader(cell);
      if (!key) continue;
      if (Object.values(ALIASES).some((aliases) => aliases.includes(key))) score += 1;
    }
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return bestScore >= 1 ? best : 0;
}

function headerMap(row: string[]): Map<string, number> {
  const map = new Map<string, number>();
  row.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (!key) return;
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(key) && !map.has(field)) map.set(field, index);
    }
  });
  return map;
}

function pick(row: string[], map: Map<string, number>, field: string): string {
  const index = map.get(field);
  if (index === undefined) return "";
  return String(row[index] ?? "").trim();
}

function onlyDigits(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function patientMatchKey(input: {
  patientNumber?: string;
  phone?: string;
  fullName?: string;
}): string {
  const number = input.patientNumber?.trim().toUpperCase();
  if (number) return `no:${number}`;
  const digits = onlyDigits(input.phone ?? "");
  if (digits) return `ph:${digits}`;
  return `nm:${String(input.fullName ?? "").trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function parseGender(raw: string): { value?: "male" | "female"; warning?: string } {
  const s = raw.trim().toLowerCase();
  if (!s) return {};
  if (["m", "male", "man", "boy"].includes(s)) return { value: "male" };
  if (["f", "female", "woman", "girl"].includes(s)) return { value: "female" };
  return { warning: `Gender "${raw}" is not male/female; left blank.` };
}

function isValidIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function parseDateValue(raw: string, field: string): { value?: string; warning?: string } {
  const s = raw.trim();
  if (!s) return {};

  // Excel serial date (days since 1899-12-30), e.g. 45678.
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 80000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const iso = new Date(ms).toISOString().slice(0, 10);
      if (isValidIso(iso)) return { value: iso };
    }
  }

  const iso = toIsoDate(s);
  if (iso && isValidIso(iso)) return { value: iso };
  return { warning: `${field} "${raw}" is not a recognised date; left blank.` };
}

function parseAmount(raw: string): number | null {
  const cleaned = String(raw ?? "").replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function normalizePaymentMethod(raw: string): ImportPaymentMethod {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "cash";
  if (/m-?pesa|mobile\s*money|mobile|airtel|telkom/.test(s)) return "mpesa";
  if (/card|visa|master|debit|credit/.test(s)) return "card";
  if (/bank|transfer|cheque|check|eft|rtgs/.test(s)) return "bank_transfer";
  if (/insur|nhif|sha|nhic|cover/.test(s)) return "insurance";
  if (/cash/.test(s)) return "cash";
  return "other";
}

export function normalizePaymentStatus(raw: string): ImportPaymentStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "paid";
  if (/unpaid|not\s*paid|pending|outstanding|bill|credit|no|false|0/.test(s)) return "unpaid";
  return "paid";
}

function pushIssue(list: ImportIssue[], row: number, message: string) {
  if (list.length < MAX_ISSUES) list.push({ row, message });
}

/** Parse workbook rows into normalized patients and consultations. */
export function parsePatientImport(rows: string[][], mode: PatientImportMode): ParsedImport {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const patients = new Map<string, ParsedPatient>();
  const consultations: ParsedConsultation[] = [];

  if (rows.length === 0) {
    return { mode, totalRows: 0, patients: [], consultations, errors, warnings };
  }

  const headerIndex = findHeaderRow(rows);
  const map = headerMap(rows[headerIndex] ?? []);
  const dataRows = rows.slice(headerIndex + 1);
  let totalRows = 0;

  function mergePatient(rowNumber: number, input: Omit<ParsedPatient, "key" | "row">) {
    const key = patientMatchKey(input);
    const existing = patients.get(key);
    if (!existing) {
      patients.set(key, { key, row: rowNumber, ...input });
      return key;
    }
    // Merge: keep the first non-empty value for each field.
    existing.fullName = existing.fullName || input.fullName;
    existing.patientNumber = existing.patientNumber || input.patientNumber;
    existing.phone = existing.phone || input.phone;
    existing.email = existing.email || input.email;
    existing.gender = existing.gender || input.gender;
    existing.dateOfBirth = existing.dateOfBirth || input.dateOfBirth;
    existing.address = existing.address || input.address;
    existing.notes = existing.notes || input.notes;
    return key;
  }

  let lastPatientKey: string | null = null;
  let lastPatientRef: { patientNumber?: string; patientName?: string; patientPhone?: string } | null =
    null;

  function findExistingKey(input: {
    patientNumber?: string;
    phone?: string;
    fullName?: string;
  }): string | null {
    const number = input.patientNumber?.trim().toUpperCase();
    if (number) {
      for (const [key, p] of patients) {
        if (p.patientNumber?.trim().toUpperCase() === number) return key;
      }
    }
    const digits = onlyDigits(input.phone ?? "");
    if (digits) {
      for (const [key, p] of patients) {
        if (onlyDigits(p.phone ?? "") === digits) return key;
      }
    }
    const name = String(input.fullName ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (name) {
      for (const [key, p] of patients) {
        if (p.fullName.trim().toLowerCase().replace(/\s+/g, " ") === name) return key;
      }
    }
    return null;
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] ?? [];
    if (!row.some((c) => String(c ?? "").trim())) continue;
    const rowNumber = headerIndex + i + 2; // 1-based sheet row (header included)
    totalRows += 1;

    const fullName = pick(row, map, "fullName");
    const patientNumber = pick(row, map, "patientNumber");
    const phone = pick(row, map, "phone");
    const email = pick(row, map, "email");
    const genderRaw = pick(row, map, "gender");
    const dobRaw = pick(row, map, "dateOfBirth");
    const address = pick(row, map, "address");
    const patientNotes = pick(row, map, "patientNotes");

    // Skip obvious total/summary rows.
    if (/^(total|totals|grand total|sum)\b/i.test(fullName) || /^(total|totals|grand total|sum)\b/i.test(pick(row, map, "procedureName"))) {
      continue;
    }

    let patientKeyForRow: string | null = null;

    if (mode !== "consultations") {
      const hasPatientDetails = Boolean(
        fullName || patientNumber || phone || email || genderRaw || dobRaw || address || patientNotes
      );

      if (fullName && fullName.length >= 2) {
        const gender = parseGender(genderRaw);
        if (gender.warning) pushIssue(warnings, rowNumber, gender.warning);
        const dob = parseDateValue(dobRaw, "Date of birth");
        if (dob.warning) pushIssue(warnings, rowNumber, dob.warning);
        if (dob.value && dob.value > new Date().toISOString().slice(0, 10)) {
          pushIssue(warnings, rowNumber, "Date of birth is in the future; left blank.");
        }
        patientKeyForRow = mergePatient(rowNumber, {
          patientNumber: patientNumber || undefined,
          fullName: fullName.trim(),
          phone: phone || undefined,
          email: email || undefined,
          gender: gender.value,
          dateOfBirth:
            dob.value && dob.value <= new Date().toISOString().slice(0, 10) ? dob.value : undefined,
          address: address || undefined,
          notes: patientNotes || undefined,
        });
        lastPatientKey = patientKeyForRow;
      } else if (mode === "combined" && hasPatientDetails) {
        // Merged/repeated cells: match this row to a patient already read.
        const found = findExistingKey({
          patientNumber: patientNumber || undefined,
          phone: phone || undefined,
          fullName: fullName || undefined,
        });
        if (found) {
          patientKeyForRow = found;
          lastPatientKey = found;
        } else {
          pushIssue(
            errors,
            rowNumber,
            "Patient full name is required on the first row for this patient."
          );
          continue;
        }
      } else if (mode === "combined" && lastPatientKey) {
        patientKeyForRow = lastPatientKey;
      } else {
        pushIssue(errors, rowNumber, "Patient full name is required.");
        continue;
      }
    }

    if (mode === "patients") continue;

    const consultationDateRaw = pick(row, map, "consultationDate");
    const procedureName = pick(row, map, "procedureName");
    const amountRaw = pick(row, map, "amount");

    const hasAnyVisitField = Boolean(consultationDateRaw || procedureName || amountRaw);
    if (mode === "combined" && !hasAnyVisitField) {
      // A patient-only row in a combined sheet is allowed.
      continue;
    }

    if (!patientKeyForRow) {
      // Consultations-only sheet: use the row reference, or the previous
      // patient when the sheet uses merged/repeated cells.
      const suppliedKey =
        patientNumber || phone || fullName
          ? patientMatchKey({
              patientNumber: patientNumber || undefined,
              phone: phone || undefined,
              fullName: fullName || undefined,
            })
          : null;
      if (suppliedKey && suppliedKey !== "nm:") {
        patientKeyForRow = suppliedKey;
      } else if (lastPatientKey) {
        patientKeyForRow = lastPatientKey;
      } else {
        pushIssue(
          errors,
          rowNumber,
          "Provide a patient number, patient name or phone to match the patient."
        );
        continue;
      }
    }

    if (!procedureName) {
      pushIssue(errors, rowNumber, "Procedure / service is required.");
      continue;
    }
    const date = parseDateValue(consultationDateRaw, "Visit date");
    if (date.warning) {
      pushIssue(errors, rowNumber, date.warning);
      continue;
    }
    if (!date.value) {
      pushIssue(errors, rowNumber, "Visit date is required.");
      continue;
    }
    const amount = parseAmount(amountRaw);
    if (amount === null) {
      pushIssue(errors, rowNumber, `Amount "${amountRaw}" is not a valid positive number.`);
      continue;
    }

    // Fill identifying fields from the parsed patient (combined mode), or from
    // the previous row when patient cells were left blank.
    const parsedPatient = patientKeyForRow ? patients.get(patientKeyForRow) : undefined;
    let refNumber = patientNumber || parsedPatient?.patientNumber || undefined;
    let refName = fullName || parsedPatient?.fullName || undefined;
    let refPhone = phone || parsedPatient?.phone || undefined;
    if (!refNumber && !refName && !refPhone && lastPatientRef) {
      refNumber = lastPatientRef.patientNumber;
      refName = lastPatientRef.patientName;
      refPhone = lastPatientRef.patientPhone;
    }
    if (!refNumber && !refName && !refPhone) {
      pushIssue(errors, rowNumber, "Patient reference is missing.");
      continue;
    }
    lastPatientKey = patientKeyForRow;
    lastPatientRef = { patientNumber: refNumber, patientName: refName, patientPhone: refPhone };

    consultations.push({
      key: `row:${rowNumber}`,
      row: rowNumber,
      patientKey: patientKeyForRow,
      patientNumber: refNumber,
      patientName: refName,
      patientPhone: refPhone,
      consultationDate: date.value,
      procedureName: procedureName.trim(),
      doctorName: pick(row, map, "doctorName") || undefined,
      amount,
      paymentMethod: normalizePaymentMethod(pick(row, map, "paymentMethod")),
      paymentStatus: normalizePaymentStatus(pick(row, map, "paymentStatus")),
      notes: pick(row, map, "consultationNotes") || undefined,
    });
  }

  return {
    mode,
    totalRows,
    patients: [...patients.values()],
    consultations,
    errors,
    warnings,
  };
}
