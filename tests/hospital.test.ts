import { describe, it, expect } from "vitest";
import { api } from "../convex/_generated/api";
import { makeTestBackend } from "./helpers/convex";

process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";

type Backend = ReturnType<typeof makeTestBackend>;

async function setup() {
  const t = makeTestBackend();
  const now = Date.now();
  const orgId = await t.run((ctx) =>
    ctx.db.insert("organizations", { name: "Hospital", slug: "hospital", active: true, createdAt: now })
  );
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      orgId,
      name: "Dr Admin",
      email: "admin@hospital.test",
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

async function registerPatient(t: Backend, orgId: any, userId: any, name = "Jane Wanjiku") {
  return t.mutation(api.patients.createPatient, {
    secret: SECRET,
    orgId,
    viewerId: userId,
    fullName: name,
    phone: "0712345678",
  });
}

async function journalsFor(t: Backend) {
  return t.run((ctx) => ctx.db.query("journals").collect());
}

describe("hospital patient consultations", () => {
  it("allocates sequential patient numbers and lists them for the company", async () => {
    const { t, orgId, userId } = await setup();
    const first = await registerPatient(t, orgId, userId, "Jane Wanjiku");
    const second = await registerPatient(t, orgId, userId, "Peter Otieno");

    expect(first.patientNumber).toBe("P-0001");
    expect(second.patientNumber).toBe("P-0002");

    const list = await t.query(api.patients.listPatients, {
      secret: SECRET,
      orgId,
      viewerId: userId,
    });
    expect(list.map((p: any) => p.fullName)).toEqual(["Jane Wanjiku", "Peter Otieno"]);
  });

  it("stores age when the date of birth is unknown", async () => {
    const { t, orgId, userId } = await setup();
    await t.mutation(api.patients.createPatient, {
      secret: SECRET,
      orgId,
      viewerId: userId,
      fullName: "Age Only Patient",
      ageYears: 35,
    });

    const list = await t.query(api.patients.listPatients, {
      secret: SECRET,
      orgId,
      viewerId: userId,
    });
    const row = list.find((p: any) => p.fullName === "Age Only Patient");
    expect(row?.ageYears).toBe(35);
    expect(row?.ageRecordedAt).toBeTruthy();
  });

  it("posts a paid consultation to cash and consultation income", async () => {
    const { t, orgId, userId } = await setup();
    const patient = await registerPatient(t, orgId, userId);

    await t.mutation(api.patients.createConsultation, {
      secret: SECRET,
      orgId,
      viewerId: userId,
      patientId: patient.id,
      consultationDate: "2026-11-20",
      procedureName: "General Consultation",
      amount: 1500,
      paymentMethod: "cash",
      paymentStatus: "paid",
    });

    const journals = await journalsFor(t);
    expect(journals).toHaveLength(1);
    expect(journals[0].source).toBe("consultation");
    const cash = journals[0].lines.find((l: any) => l.accountCode === "1000");
    const income = journals[0].lines.find((l: any) => l.accountCode === "4200");
    expect(cash?.debit).toBe(1500);
    expect(income?.credit).toBe(1500);
  });

  it("posts an unpaid consultation to accounts receivable", async () => {
    const { t, orgId, userId } = await setup();
    const patient = await registerPatient(t, orgId, userId);

    await t.mutation(api.patients.createConsultation, {
      secret: SECRET,
      orgId,
      viewerId: userId,
      patientId: patient.id,
      consultationDate: "2026-11-20",
      procedureName: "Laboratory Test",
      amount: 800,
      paymentMethod: "mpesa",
      paymentStatus: "unpaid",
    });

    const [journal] = await journalsFor(t);
    const ar = journal.lines.find((l: any) => l.accountCode === "1100");
    expect(ar?.debit).toBe(800);
  });

  it("reverses and re-posts when a visit is marked paid later", async () => {
    const { t, orgId, userId } = await setup();
    const patient = await registerPatient(t, orgId, userId);
    const consultation = await t.mutation(api.patients.createConsultation, {
      secret: SECRET,
      orgId,
      viewerId: userId,
      patientId: patient.id,
      consultationDate: "2026-11-20",
      procedureName: "X-Ray",
      amount: 1200,
      paymentMethod: "mpesa",
      paymentStatus: "unpaid",
    });

    await t.mutation(api.patients.updateConsultation, {
      secret: SECRET,
      orgId,
      viewerId: userId,
      id: consultation.id,
      paymentStatus: "paid",
      paymentMethod: "mpesa",
    });

    const journals = await journalsFor(t);
    // Original + reversal + corrected entry.
    expect(journals).toHaveLength(3);
    const active = journals.filter((j: any) => !j.reversedBy && j.source === "consultation");
    expect(active).toHaveLength(1);
    const mpesa = active[0].lines.find((l: any) => l.accountCode === "1030");
    expect(mpesa?.debit).toBe(1200);
  });

  it("reverses the journal when a consultation is deleted", async () => {
    const { t, orgId, userId } = await setup();
    const patient = await registerPatient(t, orgId, userId);
    const consultation = await t.mutation(api.patients.createConsultation, {
      secret: SECRET,
      orgId,
      viewerId: userId,
      patientId: patient.id,
      consultationDate: "2026-11-20",
      procedureName: "Vaccination",
      amount: 500,
      paymentMethod: "cash",
      paymentStatus: "paid",
    });

    await t.mutation(api.patients.deleteConsultation, {
      secret: SECRET,
      orgId,
      viewerId: userId,
      id: consultation.id,
    });

    const journals = await journalsFor(t);
    // The original is marked reversed and a mirror (active) entry cancels it.
    expect(
      journals.filter((j: any) => j.source === "consultation" && !j.reversedBy)
    ).toHaveLength(0);
    expect(journals.some((j: any) => j.source === "manual" && j.reversesId)).toBe(true);
  });

  it("registers the patient inline and posts in the same transaction", async () => {
    const { t, orgId, userId } = await setup();
    await t.mutation(api.patients.createConsultation, {
      secret: SECRET,
      orgId,
      viewerId: userId,
      newPatient: { fullName: "Amina Hassan", phone: "0722000111", gender: "female" },
      consultationDate: "2026-11-21",
      procedureName: "Maternity / Antenatal",
      amount: 2500,
      paymentMethod: "insurance",
      paymentStatus: "paid",
    });

    const patients = await t.query(api.patients.listPatients, {
      secret: SECRET,
      orgId,
      viewerId: userId,
    });
    expect(patients).toHaveLength(1);
    expect(patients[0].fullName).toBe("Amina Hassan");
    expect(await journalsFor(t)).toHaveLength(1);
  });

  it("keeps tenants isolated", async () => {
    const { t, orgId, userId } = await setup();
    const now = Date.now();
    const otherOrg = await t.run((ctx) =>
      ctx.db.insert("organizations", { name: "Other", slug: "other", active: true, createdAt: now })
    );
    const otherUser = await t.run((ctx) =>
      ctx.db.insert("users", {
        orgId: otherOrg,
        name: "Other Admin",
        email: "admin@other.test",
        passwordHash: "x",
        role: "admin",
        leaveBalance: 21,
        mustChangePassword: false,
        active: true,
        createdAt: now,
      })
    );

    const patient = await registerPatient(t, otherOrg, otherUser, "Other Patient");

    await expect(
      t.mutation(api.patients.updatePatient, {
        secret: SECRET,
        orgId,
        viewerId: userId,
        id: patient.id,
        fullName: "Hijacked",
      })
    ).rejects.toThrow(/not found/i);

    await expect(
      t.mutation(api.patients.createPatient, {
        secret: SECRET,
        orgId,
        viewerId: otherUser,
        fullName: "Cross tenant",
      })
    ).rejects.toThrow(/Not authorized/);

    const ourPatients = await t.query(api.patients.listPatients, {
      secret: SECRET,
      orgId,
      viewerId: userId,
    });
    expect(ourPatients).toHaveLength(0);
  });
});
