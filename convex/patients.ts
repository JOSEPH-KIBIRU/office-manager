import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertSecret, requireMember, requireOrg, tsNow } from "./lib";
import {
  nextSeq,
  postJournalForSource,
  resolveCashAccount,
  resolveControlCode,
  reverseJournalInternal,
  roundKes,
} from "./accounting";

/**
 * Hospital / clinic add-on: patient register + consultations.
 *
 * Every consultation fee is posted to the double-entry general ledger
 * automatically:
 *   - paid   → Dr cash / bank / M-Pesa, Cr consultation income (4200)
 *   - unpaid → Dr accounts receivable (1100), Cr consultation income (4200)
 *
 * Editing or deleting a consultation reverses its journal first, so the ledger
 * always mirrors the source record. Journals are never edited in place.
 */

const paymentMethod = v.union(
  v.literal("cash"),
  v.literal("mpesa"),
  v.literal("card"),
  v.literal("bank_transfer"),
  v.literal("insurance"),
  v.literal("other")
);

type PaymentMethod = "cash" | "mpesa" | "card" | "bank_transfer" | "insurance" | "other";

/** Allocate the next per-company patient number (P-0001, P-0002, …). */
async function nextPatientNumber(ctx: MutationCtx, orgId: Id<"organizations">): Promise<string> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const seq = await nextSeq(ctx, orgId, "PAT");
    const patientNumber = `P-${String(seq).padStart(4, "0")}`;
    const existing = await ctx.db
      .query("patients")
      .withIndex("by_org_number", (q) => q.eq("orgId", orgId).eq("patientNumber", patientNumber))
      .first();
    if (!existing) return patientNumber;
  }
  throw new Error("Could not allocate a patient number");
}

async function createPatientInternal(
  ctx: MutationCtx,
  args: {
    orgId: Id<"organizations">;
    userId: Id<"users">;
    fullName: string;
    phone?: string;
    email?: string;
    gender?: string;
    dateOfBirth?: string;
    address?: string;
    notes?: string;
  }
): Promise<{ id: Id<"patients">; patientNumber: string }> {
  const fullName = args.fullName.trim();
  if (fullName.length < 2) throw new Error("Please enter the patient's full name");

  const patientNumber = await nextPatientNumber(ctx, args.orgId);
  const id = await ctx.db.insert("patients", {
    orgId: args.orgId,
    patientNumber,
    fullName,
    phone: args.phone?.trim() || undefined,
    email: args.email?.trim() || undefined,
    gender: args.gender?.trim() || undefined,
    dateOfBirth: args.dateOfBirth?.trim() || undefined,
    address: args.address?.trim() || undefined,
    notes: args.notes?.trim() || undefined,
    createdBy: args.userId,
    createdAt: tsNow(),
  });
  return { id, patientNumber };
}

/** Which account receives the money (or the receivable when unpaid). */
async function debitAccountFor(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  method: PaymentMethod,
  paymentStatus: "paid" | "unpaid"
): Promise<string> {
  if (paymentStatus === "unpaid") return resolveControlCode(ctx, orgId, "ar");
  if (method === "cash" || method === "other") return resolveControlCode(ctx, orgId, "cash");
  if (method === "mpesa") return resolveCashAccount(ctx, orgId, "mpesa");
  // Card, bank transfer and insurance settlements all land in the bank.
  return resolveControlCode(ctx, orgId, "bank");
}

/**
 * Post (or repost) a consultation fee. `postJournalForSource` is idempotent per
 * (source, sourceId); callers must reverse the previous journal before reposting.
 */
async function postConsultationJournal(
  ctx: MutationCtx,
  args: {
    orgId: Id<"organizations">;
    userId: Id<"users">;
    userName: string;
    consultationId: Id<"patientConsultations">;
    patientNumber: string;
    patientName: string;
    consultationDate: string;
    procedureName: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: "paid" | "unpaid";
  }
): Promise<Id<"journals">> {
  const debitAccount = await debitAccountFor(ctx, args.orgId, args.paymentMethod, args.paymentStatus);
  const memo = `${args.patientNumber} · ${args.procedureName}`;
  return postJournalForSource(ctx, {
    orgId: args.orgId,
    source: "consultation",
    sourceId: args.consultationId as string,
    date: args.consultationDate,
    description: `${args.procedureName} - ${args.patientName}`,
    lines: [
      { accountCode: debitAccount, debit: args.amount, credit: 0, memo },
      { accountCode: "4200", debit: 0, credit: args.amount, memo },
    ],
    postedBy: args.userId,
    postedByName: args.userName,
  });
}

/** Reverse a consultation's current journal (no-op when it was never posted). */
async function reverseConsultationJournal(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  consultation: { journalId?: Id<"journals">; consultationDate: string }
): Promise<void> {
  if (!consultation.journalId) return;
  const journal = await ctx.db.get(consultation.journalId);
  if (!journal || journal.orgId !== orgId || journal.reversedBy) return;

  const reversal = await reverseJournalInternal(ctx, {
    orgId,
    journalId: consultation.journalId,
    date: consultation.consultationDate,
  });
  if (!reversal) {
    throw new Error("Could not reverse the accounting entry — the accounting period may be locked.");
  }
}

/* ------------------------------------------------------------------ *
 * Patients
 * ------------------------------------------------------------------ */

export const listPatients = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.viewerId);

    const rows = await ctx.db
      .query("patients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    rows.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return rows.map((p) => ({
      id: p._id,
      patientNumber: p.patientNumber,
      fullName: p.fullName,
      phone: p.phone ?? null,
      email: p.email ?? null,
      gender: p.gender ?? null,
      dateOfBirth: p.dateOfBirth ?? null,
      address: p.address ?? null,
      notes: p.notes ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt ?? null,
    }));
  },
});

export const createPatient = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    fullName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    gender: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const viewer = await requireMember(ctx, args.orgId, args.viewerId);

    const created = await createPatientInternal(ctx, {
      orgId: args.orgId,
      userId: viewer._id,
      fullName: args.fullName,
      phone: args.phone,
      email: args.email,
      gender: args.gender,
      dateOfBirth: args.dateOfBirth,
      address: args.address,
      notes: args.notes,
    });
    return created;
  },
});

export const updatePatient = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    id: v.id("patients"),
    fullName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    gender: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.viewerId);

    const patient = await ctx.db.get(args.id);
    if (!patient || patient.orgId !== args.orgId) throw new Error("Patient not found");

    const fullName = args.fullName.trim();
    if (fullName.length < 2) throw new Error("Please enter the patient's full name");

    await ctx.db.patch(args.id, {
      fullName,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
      gender: args.gender?.trim() || undefined,
      dateOfBirth: args.dateOfBirth?.trim() || undefined,
      address: args.address?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      updatedAt: tsNow(),
    });
    return { id: args.id };
  },
});

/** Delete a patient and their consultation history, reversing every journal. */
export const deletePatient = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    id: v.id("patients"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.viewerId);

    const patient = await ctx.db.get(args.id);
    if (!patient || patient.orgId !== args.orgId) throw new Error("Patient not found");

    const consultations = await ctx.db
      .query("patientConsultations")
      .withIndex("by_patient", (q) => q.eq("patientId", args.id))
      .collect();
    for (const consultation of consultations) {
      if (consultation.orgId !== args.orgId) continue;
      await reverseConsultationJournal(ctx, args.orgId, consultation);
      await ctx.db.delete(consultation._id);
    }

    await ctx.db.delete(args.id);
    return { id: args.id, deletedConsultations: consultations.length };
  },
});

/* ------------------------------------------------------------------ *
 * Consultations
 * ------------------------------------------------------------------ */

export const listConsultations = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.viewerId);

    const [rows, patients] = await Promise.all([
      ctx.db
        .query("patientConsultations")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect(),
      ctx.db.query("patients").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect(),
    ]);

    const patientMap = new Map(patients.map((p) => [p._id as string, p] as const));
    rows.sort((a, b) => {
      if (a.consultationDate !== b.consultationDate) {
        return a.consultationDate < b.consultationDate ? 1 : -1;
      }
      return b.createdAt - a.createdAt;
    });

    return rows.map((c) => {
      const patient = patientMap.get(c.patientId as string);
      return {
        id: c._id,
        patientId: c.patientId,
        patientName: patient?.fullName ?? "Unknown patient",
        patientNumber: patient?.patientNumber ?? "",
        patientPhone: patient?.phone ?? null,
        consultationDate: c.consultationDate,
        procedureName: c.procedureName,
        doctorName: c.doctorName ?? null,
        amount: c.amount,
        paymentMethod: c.paymentMethod,
        paymentStatus: c.paymentStatus,
        notes: c.notes ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt ?? null,
      };
    });
  },
});

/**
 * Record a consultation, optionally registering the patient inline. Both rows
 * and the accounting journal are written in one transaction.
 */
export const createConsultation = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    patientId: v.optional(v.id("patients")),
    newPatient: v.optional(
      v.object({
        fullName: v.string(),
        phone: v.optional(v.string()),
        gender: v.optional(v.string()),
        dateOfBirth: v.optional(v.string()),
      })
    ),
    consultationDate: v.string(),
    procedureName: v.string(),
    doctorName: v.optional(v.string()),
    amount: v.number(),
    paymentMethod,
    paymentStatus: v.union(v.literal("paid"), v.literal("unpaid")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const viewer = await requireMember(ctx, args.orgId, args.viewerId);

    const procedureName = args.procedureName.trim();
    if (!procedureName) throw new Error("Please enter the consultation procedure or service");

    const amount = roundKes(args.amount);
    if (!(amount > 0)) throw new Error("Consultation amount must be greater than zero");

    let patientId = args.patientId;
    if (!patientId) {
      if (!args.newPatient?.fullName?.trim()) {
        throw new Error("Select a patient or register a new one");
      }
      const created = await createPatientInternal(ctx, {
        orgId: args.orgId,
        userId: viewer._id,
        fullName: args.newPatient.fullName,
        phone: args.newPatient.phone,
        gender: args.newPatient.gender,
        dateOfBirth: args.newPatient.dateOfBirth,
      });
      patientId = created.id;
    }

    const patient = await ctx.db.get(patientId);
    if (!patient || patient.orgId !== args.orgId) throw new Error("Patient not found");

    const now = tsNow();
    const id = await ctx.db.insert("patientConsultations", {
      orgId: args.orgId,
      patientId,
      consultationDate: args.consultationDate,
      procedureName,
      doctorName: args.doctorName?.trim() || undefined,
      amount,
      paymentMethod: args.paymentMethod,
      paymentStatus: args.paymentStatus,
      notes: args.notes?.trim() || undefined,
      recordedBy: viewer._id,
      createdAt: now,
    });

    const journalId = await postConsultationJournal(ctx, {
      orgId: args.orgId,
      userId: viewer._id,
      userName: viewer.name,
      consultationId: id,
      patientNumber: patient.patientNumber,
      patientName: patient.fullName,
      consultationDate: args.consultationDate,
      procedureName,
      amount,
      paymentMethod: args.paymentMethod,
      paymentStatus: args.paymentStatus,
    });
    await ctx.db.patch(id, { journalId });

    return { id, patientId };
  },
});

export const updateConsultation = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    id: v.id("patientConsultations"),
    consultationDate: v.optional(v.string()),
    procedureName: v.optional(v.string()),
    doctorName: v.optional(v.string()),
    amount: v.optional(v.number()),
    paymentMethod: v.optional(paymentMethod),
    paymentStatus: v.optional(v.union(v.literal("paid"), v.literal("unpaid"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const viewer = await requireMember(ctx, args.orgId, args.viewerId);

    const consultation = await ctx.db.get(args.id);
    if (!consultation || consultation.orgId !== args.orgId) throw new Error("Consultation not found");
    const patient = await ctx.db.get(consultation.patientId);
    if (!patient || patient.orgId !== args.orgId) throw new Error("Patient not found");

    const procedureName = args.procedureName?.trim() ?? consultation.procedureName;
    if (!procedureName) throw new Error("Please enter the consultation procedure or service");
    const amount = args.amount !== undefined ? roundKes(args.amount) : consultation.amount;
    if (!(amount > 0)) throw new Error("Consultation amount must be greater than zero");

    const next = {
      consultationDate: args.consultationDate ?? consultation.consultationDate,
      procedureName,
      doctorName:
        args.doctorName !== undefined ? args.doctorName.trim() || undefined : consultation.doctorName,
      amount,
      paymentMethod: args.paymentMethod ?? (consultation.paymentMethod as PaymentMethod),
      paymentStatus: args.paymentStatus ?? consultation.paymentStatus,
      notes: args.notes !== undefined ? args.notes.trim() || undefined : consultation.notes,
      updatedAt: tsNow(),
    };

    // Reverse the old entry first so the corrected fee posts cleanly.
    await reverseConsultationJournal(ctx, args.orgId, consultation);
    await ctx.db.patch(args.id, next);

    const journalId = await postConsultationJournal(ctx, {
      orgId: args.orgId,
      userId: viewer._id,
      userName: viewer.name,
      consultationId: args.id,
      patientNumber: patient.patientNumber,
      patientName: patient.fullName,
      consultationDate: next.consultationDate,
      procedureName: next.procedureName,
      amount: next.amount,
      paymentMethod: next.paymentMethod,
      paymentStatus: next.paymentStatus,
    });
    await ctx.db.patch(args.id, { journalId });

    return { id: args.id };
  },
});

export const deleteConsultation = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    id: v.id("patientConsultations"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.viewerId);

    const consultation = await ctx.db.get(args.id);
    if (!consultation || consultation.orgId !== args.orgId) throw new Error("Consultation not found");

    await reverseConsultationJournal(ctx, args.orgId, consultation);
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});
