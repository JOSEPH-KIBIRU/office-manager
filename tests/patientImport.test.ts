import { describe, it, expect } from "vitest";
import { parsePatientImport } from "../src/lib/patientImport";
import { api } from "../convex/_generated/api";
import { makeTestBackend } from "./helpers/convex";

process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";

describe("patient import parser", () => {
  it("parses a patient sheet, normalises gender and dates", () => {
    const rows = [
      ["Patient No.", "Full Name", "Phone", "Gender", "Date of Birth", "Age", "Notes"],
      ["P-0001", "Jane Wanjiku", "0712345678", "Female", "1990-05-14", "", "No allergies"],
      ["", "Peter Otieno", "0722000111", "M", "15/08/1985", "", ""],
      ["", "Mary Achieng", "0733000222", "F", "", "41", ""],
    ];
    const parsed = parsePatientImport(rows, "patients");

    expect(parsed.patients).toHaveLength(3);
    expect(parsed.patients[0].gender).toBe("female");
    expect(parsed.patients[1].gender).toBe("male");
    expect(parsed.patients[1].dateOfBirth).toBe("1985-08-15");
    expect(parsed.patients[2].ageYears).toBe(41);
    expect(parsed.errors).toHaveLength(0);
  });

  it("carries patient details forward in a combined sheet", () => {
    const rows = [
      ["Patient No.", "Full Name", "Phone", "Visit Date", "Procedure / Service", "Amount", "Payment Method", "Payment Status"],
      ["P-0001", "Jane Wanjiku", "0712345678", "2026-11-20", "General Consultation", "1,500", "Cash", "Paid"],
      ["", "", "", "2026-11-21", "Laboratory Test", "800", "M-Pesa", "Unpaid"],
    ];
    const parsed = parsePatientImport(rows, "combined");

    expect(parsed.patients).toHaveLength(1);
    expect(parsed.consultations).toHaveLength(2);
    expect(parsed.consultations[1].patientKey).toBe(parsed.consultations[0].patientKey);
    expect(parsed.consultations[1].patientNumber).toBe("P-0001");
    expect(parsed.consultations[1].paymentMethod).toBe("mpesa");
    expect(parsed.consultations[1].paymentStatus).toBe("unpaid");
    expect(parsed.errors).toHaveLength(0);
  });

  it("carries the previous patient in a consultations-only sheet", () => {
    const rows = [
      ["Patient No.", "Patient Name", "Visit Date", "Procedure / Service", "Amount"],
      ["P-0001", "Jane Wanjiku", "2026-11-20", "Consultation", "500"],
      ["", "", "2026-11-21", "Follow-up", "300"],
    ];
    const parsed = parsePatientImport(rows, "consultations");

    expect(parsed.patients).toHaveLength(0);
    expect(parsed.consultations).toHaveLength(2);
    expect(parsed.consultations[1].patientNumber).toBe("P-0001");
  });

  it("reports invalid required fields instead of importing them", () => {
    const rows = [
      ["Full Name", "Visit Date", "Procedure / Service", "Amount"],
      ["", "2026-11-20", "Consultation", "500"],
      ["John Doe", "not-a-date", "Consultation", "500"],
      ["Mary Wanjiku", "2026-11-20", "Lab", "abc"],
    ];
    const parsed = parsePatientImport(rows, "combined");

    // Valid patient details are still kept; only the bad visit rows are rejected.
    expect(parsed.patients).toHaveLength(2);
    expect(parsed.consultations).toHaveLength(0);
    expect(parsed.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe("convex bulk import", () => {
  async function setup() {
    const t = makeTestBackend();
    const now = Date.now();
    const orgId = await t.run((ctx) =>
      ctx.db.insert("organizations", { name: "Clinic", slug: "clinic", active: true, createdAt: now })
    );
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        orgId,
        name: "Admin",
        email: "admin@clinic.test",
        passwordHash: "x",
        role: "admin",
        leaveBalance: 21,
        mustChangePassword: false,
        active: true,
        createdAt: now,
      })
    );
    return { t, orgId, userId };
  }

  it("creates imported patients and consultations with ledger entries", async () => {
    const { t, orgId, userId } = await setup();

    const patients = await t.mutation(api.patients.bulkCreatePatients, {
      secret: SECRET,
      orgId,
      viewerId: userId,
      rows: [
        { importKey: "no:P-0001", patientNumber: "P-0001", fullName: "Jane Wanjiku", phone: "0712345678", gender: "female" },
        { importKey: "nm:Peter Otieno", fullName: "Peter Otieno", phone: "0722000111", gender: "male", ageYears: 41 },
        { importKey: "nm:Jane Wanjiku", fullName: "Jane Wanjiku", phone: "0712345678" },
      ],
    });

    expect(patients.created).toBe(2);
    expect(patients.skipped).toBe(1);

    const list = await t.query(api.patients.listPatients, { secret: SECRET, orgId, viewerId: userId });
    expect(list).toHaveLength(2);
    expect(list.find((p: any) => p.fullName === "Peter Otieno")?.ageYears).toBe(41);
    const jane = list.find((p: any) => p.fullName === "Jane Wanjiku")!;

    const consultations = await t.mutation(api.patients.bulkCreateConsultations, {
      secret: SECRET,
      orgId,
      viewerId: userId,
      rows: [
        {
          importKey: "row:2",
          patientId: jane.id,
          consultationDate: "2026-11-20",
          procedureName: "General Consultation",
          amount: 1500,
          paymentMethod: "cash",
          paymentStatus: "paid",
        },
      ],
    });
    expect(consultations.created).toBe(1);

    const journals = await t.run((ctx) => ctx.db.query("journals").collect());
    expect(journals).toHaveLength(1);
    expect(journals[0].source).toBe("consultation");
    expect(journals[0].lines.find((l: any) => l.accountCode === "4200")?.credit).toBe(1500);
  });
});
