import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requirePermission } from "@/lib/permissionGuard";
import { handle } from "@/lib/api";
import type { PatientImportMode } from "@/lib/patientImport";

export const runtime = "nodejs";

const PATIENT_COLUMNS = [
  { header: "Patient No.", key: "patientNumber", width: 14 },
  { header: "Full Name", key: "fullName", width: 28 },
  { header: "Phone", key: "phone", width: 18 },
  { header: "Email", key: "email", width: 26 },
  { header: "Gender", key: "gender", width: 12 },
  { header: "Date of Birth", key: "dateOfBirth", width: 16 },
  { header: "Address", key: "address", width: 24 },
  { header: "Patient Notes", key: "patientNotes", width: 30 },
];

const CONSULTATION_COLUMNS = [
  { header: "Patient No.", key: "patientNumber", width: 14 },
  { header: "Patient Name", key: "patientName", width: 28 },
  { header: "Phone", key: "phone", width: 18 },
  { header: "Visit Date", key: "visitDate", width: 16 },
  { header: "Procedure / Service", key: "procedure", width: 28 },
  { header: "Doctor", key: "doctor", width: 22 },
  { header: "Amount", key: "amount", width: 14 },
  { header: "Payment Method", key: "paymentMethod", width: 18 },
  { header: "Payment Status", key: "paymentStatus", width: 16 },
  { header: "Visit Notes", key: "visitNotes", width: 30 },
];

function columnsFor(mode: PatientImportMode) {
  if (mode === "patients") return PATIENT_COLUMNS;
  if (mode === "consultations") return CONSULTATION_COLUMNS;
  return [
    ...PATIENT_COLUMNS.filter((c) => c.key !== "patientNotes"),
    { header: "Patient Notes", key: "patientNotes", width: 26 },
    { header: "Visit Date", key: "visitDate", width: 16 },
    { header: "Procedure / Service", key: "procedure", width: 28 },
    { header: "Doctor", key: "doctor", width: 22 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Payment Method", key: "paymentMethod", width: 18 },
    { header: "Payment Status", key: "paymentStatus", width: 16 },
    { header: "Visit Notes", key: "visitNotes", width: 26 },
  ];
}

function sampleRow(mode: PatientImportMode) {
  const patient = {
    patientNumber: "P-0001",
    fullName: "Jane Wanjiku",
    phone: "0712345678",
    email: "jane@example.com",
    gender: "female",
    dateOfBirth: "1990-05-14",
    address: "Nairobi",
    patientNotes: "No known allergies",
  };
  const visit = {
    patientNumber: "P-0001",
    patientName: "Jane Wanjiku",
    phone: "0712345678",
    visitDate: "2026-11-20",
    procedure: "General Consultation",
    doctor: "Dr. Otieno",
    amount: 1500,
    paymentMethod: "cash",
    paymentStatus: "paid",
    visitNotes: "Follow-up in 2 weeks",
  };
  if (mode === "patients") return patient;
  if (mode === "consultations") return visit;
  return { ...patient, ...visit };
}

/** GET /api/patients/import/template?mode=patients|consultations|combined */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requirePermission("patients", ["admin", "secretary", "manager"]);

    const raw = new URL(req.url).searchParams.get("mode") ?? "patients";
    const mode: PatientImportMode =
      raw === "consultations" || raw === "combined" ? raw : "patients";

    const wb = new ExcelJS.Workbook();
    wb.creator = "Office Manager";
    wb.created = new Date();

    const sheet = wb.addWorksheet(
      mode === "patients" ? "Patients" : mode === "consultations" ? "Consultations" : "Patients + visits",
      { views: [{ state: "frozen", ySplit: 1 }] }
    );
    sheet.columns = columnsFor(mode);
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    header.alignment = { vertical: "middle" };
    header.height = 22;
    sheet.addRow(sampleRow(mode));

    const notes = wb.addWorksheet("Instructions");
    notes.columns = [{ width: 110 }];
    const lines =
      mode === "patients"
        ? [
            "PATIENT IMPORT TEMPLATE",
            "",
            "One row per patient.",
            "Required: Full Name.",
            "Optional: Patient No. (leave blank to auto-number P-0001, P-0002…), Phone, Email, Gender, Date of Birth, Address, Notes.",
            "Gender: male or female.",
            "Dates: YYYY-MM-DD or DD/MM/YYYY.",
            "Duplicate patients are matched by Patient No., Phone or Full Name and skipped.",
            "Maximum 5,000 data rows per file.",
          ]
        : mode === "consultations"
        ? [
            "CONSULTATION IMPORT TEMPLATE",
            "",
            "One row per visit. Patients must already exist in the patient register.",
            "Match the patient with at least one of: Patient No., Patient Name, Phone.",
            "Required: Visit Date, Procedure / Service, Amount.",
            "Payment Method: cash, mpesa, card, bank_transfer, insurance or other (default cash).",
            "Payment Status: paid or unpaid (default paid).",
            "Dates: YYYY-MM-DD or DD/MM/YYYY.",
            "Every imported visit posts to the accounting ledger automatically.",
            "Maximum 5,000 data rows per file.",
          ]
        : [
            "PATIENT + VISIT IMPORT TEMPLATE",
            "",
            "One row per visit. Patient details can be repeated on every row, or left blank after the first row.",
            "Required for the patient: Full Name.",
            "Required for a visit: Visit Date, Procedure / Service, Amount.",
            "Gender: male or female.",
            "Payment Method: cash, mpesa, card, bank_transfer, insurance or other (default cash).",
            "Payment Status: paid or unpaid (default paid).",
            "Dates: YYYY-MM-DD or DD/MM/YYYY.",
            "Patients are matched by Patient No., Phone or Full Name. New patients are created; existing patients are reused.",
            "Every imported visit posts to the accounting ledger automatically.",
            "Maximum 5,000 data rows per file.",
          ];

    lines.forEach((text, index) => {
      const row = notes.addRow([text]);
      if (index === 0) row.font = { bold: true, size: 14 };
    });

    const buffer = await wb.xlsx.writeBuffer();
    const filename =
      mode === "patients"
        ? "patient-import-template.xlsx"
        : mode === "consultations"
        ? "consultation-import-template.xlsx"
        : "patient-and-consultation-import-template.xlsx";

    return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
