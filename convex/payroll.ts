import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, requireMember, tsNow, orgBranding } from "./lib";
import { pushNotification } from "./notifications";
import { tryPostJournalForSource } from "./accounting";

// ---- Kenya PAYE (annual) tax bands ----
const PAYEE_BANDS: Array<[number, number]> = [
  [0, 0.10],
  [288000, 0.25],
  [388000, 0.30],
  [6000000, 0.325],
  [9600000, 0.35],
];
const PERSONAL_RELIEF_MONTHLY = 2400;

// NSSF Act 2013, Year 4 (from Feb 2026): 6% employee, split into Tier I
// (up to the lower earnings limit) and Tier II (above it, up to the upper
// earnings limit). Employer contributes the same again.
const NSSF_RATE = 0.06;
const NSSF_TIER1_LIMIT = 8000;
const NSSF_UPPER_LIMIT = 108000;

// Register of pension schemes: 6% of pensionable pay for "Permanent &
// Pensionable" employees, up to KRA's KSh 30,000/month deductible ceiling.
const PENSION_RATE = 0.06;
const PENSION_MONTHLY_CAP = 30000;

// SHIF (Social Health Insurance Fund) — 2.75% of gross, minimum KSh 300/month.
const SHIF_RATE = 0.0275;
const SHIF_MINIMUM = 300;

const HOUSING_RATE = 0.015;

const round2 = (n: number) => Math.round(n * 100) / 100;

function nssfTiers(pensionablePay: number): { tier1: number; tier2: number } {
  const capped = Math.min(Math.max(pensionablePay, 0), NSSF_UPPER_LIMIT);
  const tier1 = Math.min(capped, NSSF_TIER1_LIMIT) * NSSF_RATE;
  const tier2 = Math.max(0, capped - NSSF_TIER1_LIMIT) * NSSF_RATE;
  return { tier1, tier2 };
}

function calcTax(chargeableMonthly: number): { incomeTax: number; personalRelief: number; paye: number } {
  const annual = Math.max(0, chargeableMonthly) * 12;
  let tax = 0;
  for (let i = 0; i < PAYEE_BANDS.length; i++) {
    const [lower, rate] = PAYEE_BANDS[i];
    const upper = i + 1 < PAYEE_BANDS.length ? PAYEE_BANDS[i + 1][0] : Number.MAX_SAFE_INTEGER;
    const bracketCap = Math.min(annual, upper);
    if (bracketCap > lower) {
      tax += (bracketCap - lower) * rate;
    }
  }
  const incomeTax = tax / 12;
  const personalRelief = PERSONAL_RELIEF_MONTHLY;
  const paye = Math.max(0, incomeTax - personalRelief);
  return { incomeTax, personalRelief, paye };
}

export const getPayslip = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("payrolls"),
    viewerId: v.id("users"),
    admin: v.optional(v.boolean()),
    userId: v.optional(v.id("users")),
    casualId: v.optional(v.id("casuals")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const viewer = await requireMember(ctx, args.orgId, args.viewerId);
    const admin = viewer.role === "admin";
    const payroll = await ctx.db.get(args.id);
    if (!payroll || payroll.orgId !== args.orgId) throw new Error("Payroll not found");

    const branding = await orgBranding(ctx, args.orgId);
    const payslip = args.casualId
      ? payroll.payslips.find((p) => p.casualId === args.casualId)
      : payroll.payslips.find((p) => p.userId === (admin && args.userId ? args.userId : viewer._id));
    if (!payslip) throw new Error("Payslip not found");
    return { id: args.id, month: payroll.month, year: payroll.year, org: branding, ...payslip };
  },
});

/** List the payslips belonging to a single user (their payslips across runs). */
export const listMyPayslips = query({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    const rows = await ctx.db.query("payrolls").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return [...rows]
      .sort((a, b) => b.year - a.year || b.month - a.month)
      .filter((p) => p.payslips.some((s) => s.userId === args.userId))
      .map((p) => {
        const slip = p.payslips.find((s) => s.userId === args.userId)!;
        return {
          id: p._id,
          month: p.month,
          year: p.year,
          grossPay: slip.grossPay,
          netPay: slip.netPay,
          created_at: new Date(p.createdAt).toISOString().replace("T", " ").slice(0, 19),
        };
      });
  },
});

export const listPayrolls = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("payrolls").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return [...rows]
      .sort((a, b) => b.year - a.year || b.month - a.month)
      .map((p) => ({
        id: p._id,
        month: p.month,
        year: p.year,
        count: p.payslips.length,
        created_at: new Date(p.createdAt).toISOString().replace("T", " ").slice(0, 19),
        gross: p.payslips.reduce((s, x) => s + x.grossPay, 0),
        net: p.payslips.reduce((s, x) => s + x.netPay, 0),
        paid: !!p.paidAt,
        paid_at: p.paidAt ? new Date(p.paidAt).toISOString().replace("T", " ").slice(0, 19) : null,
      }));
  },
});

export const listMonthlyPayslips = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("payrolls") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const payroll = await ctx.db.get(args.id);
    if (!payroll || payroll.orgId !== args.orgId) throw new Error("Payroll not found");
    return {
      id: payroll._id,
      month: payroll.month,
      year: payroll.year,
      paid: !!payroll.paidAt,
      paid_at: payroll.paidAt ? new Date(payroll.paidAt).toISOString().replace("T", " ").slice(0, 19) : null,
      paymentMethod: payroll.paymentMethod ?? null,
      payslips: payroll.payslips.map((p) => ({
        userId: p.userId ?? null,
        casualId: p.casualId ?? null,
        personType: p.personType ?? "employee",
        name: p.name,
        employeeNumber: p.employeeNumber ?? null,
        role: p.role,
        employmentType: p.employmentType ?? "permanent",
        basicSalary: p.basicSalary,
        allowances: p.allowances,
        perDiem: p.perDiem ?? 0,
        overtimeHours: p.overtimeHours ?? 0,
        overtimeRate: p.overtimeRate ?? 0,
        overtimePay: p.overtimePay ?? 0,
        bonus: p.bonus ?? 0,
        leaveDaysPayout: p.leaveDaysPayout,
        daysWorked: p.daysWorked ?? null,
        dailyRate: p.dailyRate ?? null,
        statutory: p.statutory ?? true,
        pension: p.pension ?? 0,
        helb: p.helb,
        loanRepayment: p.loanRepayment ?? 0,
        otherDeductions: p.otherDeductions ?? 0,
        grossPay: p.grossPay,
        netPay: p.netPay,
        totalDeductions: p.totalDeductions,
      })),
    };
  },
});

/** Full run detail with staff bank / M-Pesa / statutory info, for exports and returns. */
export const payrollRunDetail = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("payrolls") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const payroll = await ctx.db.get(args.id);
    if (!payroll || payroll.orgId !== args.orgId) throw new Error("Payroll not found");
    const users = await ctx.db.query("users").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const userMap = new Map(users.map((u) => [u._id, u]));
    const org = await ctx.db.get(args.orgId);
    return {
      id: payroll._id,
      month: payroll.month,
      year: payroll.year,
      paid: !!payroll.paidAt,
      paid_at: payroll.paidAt ? new Date(payroll.paidAt).toISOString().replace("T", " ").slice(0, 19) : null,
      payment_method: payroll.paymentMethod ?? null,
      org_name: org?.name ?? "Office",
      org: await orgBranding(ctx, args.orgId),
      payslips: payroll.payslips.map((p) => {
        const u = p.userId ? userMap.get(p.userId) : undefined;
        return {
          userId: p.userId ?? null,
          casualId: p.casualId ?? null,
          personType: p.personType ?? "employee",
          name: p.name,
          employeeNumber: p.employeeNumber ?? null,
          role: p.role,
          employmentType: p.employmentType ?? "permanent",
          statutoryNumber: u?.statutoryNumber ?? null,
          bankName: u?.bankName ?? null,
          bankAccount: u?.bankAccount ?? null,
          mpesaNumber: u?.mpesaNumber ?? u?.phone ?? null,
          phone: u?.phone ?? null,
          basicSalary: p.basicSalary,
          allowances: p.allowances,
          perDiem: p.perDiem ?? 0,
          overtimePay: p.overtimePay ?? 0,
          bonus: p.bonus ?? 0,
          leaveDaysPayout: p.leaveDaysPayout,
          grossPay: p.grossPay,
          nssf: p.nssf,
          nssfTier1: p.nssfTier1 ?? 0,
          nssfTier2: p.nssfTier2 ?? 0,
          sha: p.sha,
          housingLevy: p.housingLevy,
          pension: p.pension ?? 0,
          taxablePay: p.taxablePay ?? 0,
          paye: p.paye,
          helb: p.helb,
          loanRepayment: p.loanRepayment ?? 0,
          otherDeductions: p.otherDeductions ?? 0,
          totalDeductions: p.totalDeductions,
          netPay: p.netPay,
        };
      }),
    };
  },
});

/** Annual tax deduction card (P9) for one employee across a calendar year. */
export const p9ForYear = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    year: v.number(),
    viewerId: v.id("users"),
    admin: v.optional(v.boolean()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const viewer = await requireMember(ctx, args.orgId, args.viewerId);
    const admin = viewer.role === "admin";
    const subject = admin && args.userId ? args.userId : viewer._id;
    const employee = await ctx.db.get(subject);
    if (!employee || employee.orgId !== args.orgId) throw new Error("Employee not found");

    const org = await ctx.db.get(args.orgId);
    const runs = await ctx.db.query("payrolls").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const yearRuns = runs.filter((p) => p.year === args.year);

    const months: Array<Record<string, number>> = [];
    for (let m = 1; m <= 12; m++) {
      const run = yearRuns.find((r) => r.month === m);
      const slip = run?.payslips.find((s) => s.userId === subject);
      if (!slip) continue;
      months.push({
        month: m,
        basicSalary: slip.basicSalary,
        allowances: slip.allowances,
        leaveDaysPayout: slip.leaveDaysPayout,
        grossPay: slip.grossPay,
        nssf: slip.nssf,
        sha: slip.sha,
        housingLevy: slip.housingLevy,
        pension: slip.pension ?? 0,
        taxablePay: slip.taxablePay ?? 0,
        incomeTax: slip.incomeTax ?? 0,
        personalRelief: slip.personalRelief ?? 0,
        paye: slip.paye,
        helb: slip.helb,
        totalDeductions: slip.totalDeductions,
        netPay: slip.netPay,
      });
    }

    const sum = (key: string) => months.reduce((acc, r) => acc + (r[key] as number), 0);

    return {
      year: args.year,
      org_name: org?.name ?? "Office",
      org: await orgBranding(ctx, args.orgId),
      employee: {
        id: employee._id,
        name: employee.name,
        employee_number: employee.employeeNumber ?? null,
        role: employee.role,
        employment_type: employee.employmentType ?? "permanent",
        statutory_number: employee.statutoryNumber ?? null,
      },
      months: months as never,
      totals: {
        basic_salary: sum("basicSalary"),
        allowances: sum("allowances"),
        leave_days_payout: sum("leaveDaysPayout"),
        gross_pay: sum("grossPay"),
        nssf: sum("nssf"),
        sha: sum("sha"),
        housing_levy: sum("housingLevy"),
        pension: sum("pension"),
        taxable_pay: sum("taxablePay"),
        income_tax: sum("incomeTax"),
        personal_relief: sum("personalRelief"),
        paye: sum("paye"),
        helb: sum("helb"),
        total_deductions: sum("totalDeductions"),
        net_pay: sum("netPay"),
      },
    };
  },
});

// ------------------------------- Casuals -------------------------------

export const listCasuals = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("casuals").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return [...rows]
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
      .map((c) => ({
        id: c._id,
        name: c.name,
        phone: c.phone ?? null,
        idNumber: c.idNumber ?? null,
        dailyRate: c.dailyRate,
        active: c.active,
        created_at: new Date(c.createdAt).toISOString().replace("T", " ").slice(0, 19),
      }));
  },
});

export const createCasual = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
    phone: v.optional(v.string()),
    idNumber: v.optional(v.string()),
    dailyRate: v.number(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    if (!args.name.trim()) throw new Error("Name is required");
    if (args.dailyRate < 0) throw new Error("Daily rate cannot be negative");
    return ctx.db.insert("casuals", {
      orgId: args.orgId,
      name: args.name.trim(),
      phone: args.phone?.trim() || undefined,
      idNumber: args.idNumber?.trim() || undefined,
      dailyRate: args.dailyRate,
      active: true,
      createdAt: tsNow(),
    });
  },
});

export const updateCasual = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("casuals"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    idNumber: v.optional(v.string()),
    dailyRate: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const casual = await ctx.db.get(args.id);
    if (!casual || casual.orgId !== args.orgId) throw new Error("Casual not found");
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.idNumber !== undefined) patch.idNumber = args.idNumber.trim() || undefined;
    if (args.dailyRate !== undefined) patch.dailyRate = args.dailyRate;
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(args.id, patch);
    return { id: args.id };
  },
});

export const deleteCasual = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("casuals") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const casual = await ctx.db.get(args.id);
    if (!casual || casual.orgId !== args.orgId) throw new Error("Casual not found");
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});

// --------------------------- Casual attendance ---------------------------

export const listCasualAttendance = query({
  args: { secret: v.string(), orgId: v.id("organizations"), month: v.optional(v.number()), year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("casualAttendance").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    let filtered = rows;
    if (args.month && args.year) {
      const prefix = `${args.year}-${String(args.month).padStart(2, "0")}`;
      filtered = rows.filter((r) => r.date.startsWith(prefix));
    }
    const casuals = await ctx.db.query("casuals").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const nameMap = new Map(casuals.map((c) => [c._id, c.name]));
    return [...filtered]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((r) => ({
        id: r._id,
        casualId: r.casualId,
        casualName: nameMap.get(r.casualId) ?? "Unknown",
        date: r.date,
        days: r.days,
        note: r.note ?? null,
        created_at: new Date(r.createdAt).toISOString().replace("T", " ").slice(0, 19),
      }));
  },
});

/** Total days worked per casual for a month, used to prefill the payroll run. */
export const casualAttendanceSummary = query({
  args: { secret: v.string(), orgId: v.id("organizations"), month: v.number(), year: v.number() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const prefix = `${args.year}-${String(args.month).padStart(2, "0")}`;
    const rows = await ctx.db.query("casualAttendance").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const totals: Record<string, number> = {};
    for (const r of rows) {
      if (!r.date.startsWith(prefix)) continue;
      totals[r.casualId as string] = (totals[r.casualId as string] ?? 0) + r.days;
    }
    return totals;
  },
});

export const logCasualAttendance = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    casualId: v.id("casuals"),
    date: v.string(),
    days: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const casual = await ctx.db.get(args.casualId);
    if (!casual || casual.orgId !== args.orgId) throw new Error("Casual not found");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("Invalid date");
    if (args.days <= 0) throw new Error("Days must be greater than zero");

    // One row per casual per day (upsert).
    const existing = await ctx.db
      .query("casualAttendance")
      .withIndex("by_org_casual", (q) => q.eq("orgId", args.orgId).eq("casualId", args.casualId))
      .collect();
    const same = existing.find((r) => r.date === args.date);
    if (same) {
      await ctx.db.patch(same._id, { days: args.days, note: args.note?.trim() || undefined });
      return { id: same._id, updated: true };
    }
    const id = await ctx.db.insert("casualAttendance", {
      orgId: args.orgId,
      casualId: args.casualId,
      date: args.date,
      days: args.days,
      note: args.note?.trim() || undefined,
      createdAt: tsNow(),
    });
    return { id, updated: false };
  },
});

export const deleteCasualAttendance = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("casualAttendance") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== args.orgId) throw new Error("Attendance record not found");
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});

// ------------------------------- Staff loans -------------------------------

export const listStaffLoans = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("staffLoans").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const users = await ctx.db.query("users").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const nameMap = new Map(users.map((u) => [u._id, u.name]));
    return [...rows]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((l) => ({
        id: l._id,
        userId: l.userId,
        userName: nameMap.get(l.userId) ?? "Unknown",
        kind: l.kind,
        principal: l.principal,
        balance: l.balance,
        monthlyDeduction: l.monthlyDeduction,
        description: l.description ?? null,
        active: l.active,
        created_at: new Date(l.createdAt).toISOString().replace("T", " ").slice(0, 19),
      }));
  },
});

export const createStaffLoan = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    kind: v.union(v.literal("loan"), v.literal("advance")),
    principal: v.number(),
    monthlyDeduction: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.userId);
    if (!user || user.orgId !== args.orgId) throw new Error("Employee not found");
    if (args.principal <= 0) throw new Error("Amount must be greater than zero");
    if (args.monthlyDeduction <= 0) throw new Error("Monthly recovery must be greater than zero");
    const id = await ctx.db.insert("staffLoans", {
      orgId: args.orgId,
      userId: args.userId,
      kind: args.kind,
      principal: args.principal,
      balance: args.principal,
      monthlyDeduction: args.monthlyDeduction,
      description: args.description?.trim() || undefined,
      active: true,
      createdAt: tsNow(),
    });
    return id;
  },
});

export const updateStaffLoan = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("staffLoans"),
    monthlyDeduction: v.optional(v.number()),
    balance: v.optional(v.number()),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const loan = await ctx.db.get(args.id);
    if (!loan || loan.orgId !== args.orgId) throw new Error("Loan not found");
    const patch: Record<string, unknown> = {};
    if (args.monthlyDeduction !== undefined) patch.monthlyDeduction = args.monthlyDeduction;
    if (args.balance !== undefined) patch.balance = args.balance;
    if (args.description !== undefined) patch.description = args.description.trim() || undefined;
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(args.id, patch);
    return { id: args.id };
  },
});

export const deleteStaffLoan = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("staffLoans") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const loan = await ctx.db.get(args.id);
    if (!loan || loan.orgId !== args.orgId) throw new Error("Loan not found");
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});

// ------------------------------- Payroll runs -------------------------------

export const markPayrollPaid = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("payrolls"),
    paid: v.boolean(),
    paidBy: v.id("users"),
    method: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const payroll = await ctx.db.get(args.id);
    if (!payroll || payroll.orgId !== args.orgId) throw new Error("Payroll not found");
    await ctx.db.patch(args.id, {
      paidAt: args.paid ? tsNow() : undefined,
      paidBy: args.paid ? args.paidBy : undefined,
      paymentMethod: args.paid ? args.method?.trim() || "bank" : undefined,
    });
    return { id: args.id, paid: args.paid };
  },
});

export const runPayroll = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    runBy: v.id("users"),
    month: v.number(),
    year: v.number(),
    employeeIds: v.optional(v.array(v.id("users"))),
    allowances: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    perDiems: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    overtime: v.optional(
      v.array(v.object({ userId: v.id("users"), hours: v.number(), rate: v.number() }))
    ),
    bonuses: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    otherDeductions: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    leaveDaysPayouts: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    casuals: v.optional(
      v.array(
        v.object({
          casualId: v.id("casuals"),
          days: v.number(),
          statutory: v.boolean(),
          perDiem: v.optional(v.number()),
        })
      )
    ),
    encashmentIds: v.optional(v.array(v.id("leaveCarryOvers"))),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    if (args.month < 1 || args.month > 12) throw new Error("Invalid month");
    if (args.year < 2000 || args.year > 2100) throw new Error("Invalid year");

    const existing = await ctx.db
      .query("payrolls")
      .withIndex("by_org_month_year", (q) => q.eq("orgId", args.orgId).eq("month", args.month).eq("year", args.year))
      .first();
    if (existing) throw new Error(`Payroll for ${args.month}/${args.year} already exists`);

    const users = await ctx.db.query("users").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const selected = new Set(args.employeeIds ?? []);

    // Recover active staff loans / advances from this run.
    const allLoans = await ctx.db.query("staffLoans").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const activeLoans = allLoans.filter((l) => l.active && l.balance > 0.001);
    const loansByUser = new Map<string, Array<(typeof activeLoans)[number]>>();
    for (const l of activeLoans) {
      const key = l.userId as string;
      if (!loansByUser.has(key)) loansByUser.set(key, []);
      loansByUser.get(key)!.push(l);
    }

    const loanRepayments: Array<{ loanId: string; applied: number }> = [];
    const loanMap = new Map<string, number>();
    const loanIdMap = new Map<string, string>();
    for (const u of users) {
      const loans = loansByUser.get(u._id as string);
      if (!loans) continue;
      let total = 0;
      for (const l of loans) {
        const applied = Math.min(l.monthlyDeduction, l.balance);
        if (applied <= 0) continue;
        total += applied;
        loanRepayments.push({ loanId: l._id as string, applied });
        if (!loanIdMap.has(u._id as string)) loanIdMap.set(u._id as string, l._id as string);
      }
      if (total > 0) loanMap.set(u._id as string, round2(total));
    }

    const employeeSlips = buildPayslips(
      users,
      args.allowances ?? [],
      args.perDiems ?? [],
      args.overtime ?? [],
      args.bonuses ?? [],
      args.otherDeductions ?? [],
      args.leaveDaysPayouts ?? [],
      loanMap,
      loanIdMap,
      selected
    );

    const allCasuals = await ctx.db.query("casuals").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const casualMap = new Map(allCasuals.map((c) => [c._id, c]));
    const casualSlips = (args.casuals ?? [])
      .map((entry) => {
        const c = casualMap.get(entry.casualId);
        if (!c) return null;
        const days = Math.max(0, entry.days);
        return computeSlip({
          personType: "casual",
          casualId: c._id,
          name: c.name,
          role: "Casual",
          employmentType: "casual",
          basicSalary: c.dailyRate * days,
          allowances: 0,
          perDiem: entry.perDiem ?? 0,
          overtimePay: 0,
          bonus: 0,
          leaveDaysPayout: 0,
          daysWorked: days,
          dailyRate: c.dailyRate,
          helb: 0,
          otherDeductions: 0,
          loanRepayment: 0,
          statutory: entry.statutory,
        });
      })
      .filter((s): s is ReturnType<typeof computeSlip> => s !== null);

    const payslips = [...employeeSlips, ...casualSlips];

    const id = await ctx.db.insert("payrolls", {
      orgId: args.orgId,
      month: args.month,
      year: args.year,
      runBy: args.runBy,
      createdAt: tsNow(),
      payslips,
    });

    // Mark any leave-encashment rows included in this run as paid.
    for (const eid of args.encashmentIds ?? []) {
      const row = await ctx.db.get(eid);
      if (row && row.orgId === args.orgId && !row.paidAt) {
        await ctx.db.patch(row._id, { paidAt: tsNow() });
      }
    }

    // Apply the loan recoveries to balances.
    for (const r of loanRepayments) {
      const loan = (await ctx.db.get(r.loanId as never)) as { _id: any; balance: number } | null;
      if (!loan) continue;
      const balance = round2(Math.max(0, loan.balance - r.applied));
      await ctx.db.patch(loan._id, { balance, active: balance > 0.001 });
    }

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (const slip of payslips) {
      if (!slip.userId) continue;
      await pushNotification(ctx, args.orgId as unknown as string, {
        userId: slip.userId as unknown as string,
        type: "payroll",
        title: "Your payslip is ready",
        body: `Payslip for ${MONTHS[args.month - 1]} ${args.year} is available. Net pay KSh ${slip.netPay.toLocaleString("en-KE")}.`,
        link: "/my-payslips",
      });
    }

    const totals = payslips.reduce(
      (acc, s) => {
        acc.gross += s.grossPay;
        acc.paye += s.paye;
        acc.nssf += s.nssf;
        acc.sha += s.sha;
        acc.housing += s.housingLevy;
        acc.helb += s.helb;
        acc.pension += s.pension ?? 0;
        acc.loans += s.loanRepayment ?? 0;
        acc.other += s.otherDeductions ?? 0;
        acc.net += s.netPay;
        return acc;
      },
      { gross: 0, paye: 0, nssf: 0, sha: 0, housing: 0, helb: 0, pension: 0, loans: 0, other: 0, net: 0 }
    );
    const lastDay = new Date(Date.UTC(args.year, args.month, 0)).toISOString().slice(0, 10);
    await tryPostJournalForSource(ctx, {
      orgId: args.orgId,
      source: "payroll",
      sourceId: id,
      date: lastDay,
      description: `Payroll ${MONTHS[args.month - 1]} ${args.year}`,
      lines: [
        { accountCode: "5000", debit: totals.gross, credit: 0, memo: "Gross pay" },
        { accountCode: "2100", debit: 0, credit: totals.paye, memo: "PAYE" },
        { accountCode: "2110", debit: 0, credit: totals.nssf, memo: "NSSF" },
        { accountCode: "2120", debit: 0, credit: totals.sha, memo: "SHIF" },
        { accountCode: "2130", debit: 0, credit: totals.housing, memo: "Housing levy" },
        { accountCode: "2160", debit: 0, credit: totals.helb, memo: "HELB" },
        { accountCode: "2170", debit: 0, credit: totals.pension, memo: "Pension" },
        { accountCode: "2180", debit: 0, credit: totals.loans, memo: "Staff loans/advances recovery" },
        { accountCode: "2190", debit: 0, credit: totals.other, memo: "Other deductions" },
        { accountCode: "1020", debit: 0, credit: totals.net, memo: "Net pay" },
      ],
      postedByName: "Auto (payroll run)",
    });

    return { id, count: payslips.length };
  },
});

export const updatePayroll = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("payrolls"),
    allowances: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    perDiems: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    overtime: v.optional(
      v.array(v.object({ userId: v.id("users"), hours: v.number(), rate: v.number() }))
    ),
    overtimeAmounts: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    bonuses: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    otherDeductions: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    leaveDaysPayouts: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    basicSalaries: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    helbDeductions: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    casualDays: v.optional(v.array(v.object({ casualId: v.id("casuals"), days: v.number() }))),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const payroll = await ctx.db.get(args.id);
    if (!payroll || payroll.orgId !== args.orgId) throw new Error("Payroll not found");

    const allowanceMap = new Map((args.allowances ?? []).map((a) => [a.userId, a.amount]));
    const perDiemMap = new Map((args.perDiems ?? []).map((a) => [a.userId, a.amount]));
    const overtimeMap = new Map((args.overtime ?? []).map((a) => [a.userId, a]));
    const overtimeAmountMap = new Map((args.overtimeAmounts ?? []).map((a) => [a.userId, a.amount]));
    const bonusMap = new Map((args.bonuses ?? []).map((a) => [a.userId, a.amount]));
    const otherMap = new Map((args.otherDeductions ?? []).map((a) => [a.userId, a.amount]));
    const leaveMap = new Map((args.leaveDaysPayouts ?? []).map((a) => [a.userId, a.amount]));
    const basicMap = new Map((args.basicSalaries ?? []).map((a) => [a.userId, a.amount]));
    const helbMap = new Map((args.helbDeductions ?? []).map((a) => [a.userId, a.amount]));
    const casualDayMap = new Map((args.casualDays ?? []).map((a) => [a.casualId, a.days]));

    const users = await ctx.db.query("users").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const userMap = new Map(users.map((u) => [u._id, u]));

    const payslips = payroll.payslips.map((slip) => {
      if (slip.personType === "casual" || slip.casualId) {
        const days = casualDayMap.get(slip.casualId as never) ?? slip.daysWorked ?? 0;
        const dailyRate = slip.dailyRate ?? 0;
        return computeSlip({
          personType: "casual",
          casualId: slip.casualId,
          name: slip.name,
          employeeNumber: slip.employeeNumber,
          role: slip.role,
          employmentType: "casual",
          basicSalary: dailyRate * days,
          allowances: 0,
          perDiem: slip.perDiem ?? 0,
          overtimePay: 0,
          bonus: 0,
          leaveDaysPayout: 0,
          daysWorked: days,
          dailyRate,
          helb: 0,
          otherDeductions: 0,
          loanRepayment: 0,
          statutory: slip.statutory ?? true,
        });
      }
      const u = slip.userId ? userMap.get(slip.userId) : undefined;
      const key = slip.userId as never;
      const ot = overtimeMap.get(key);
      const otAmount = overtimeAmountMap.get(key);
      const overtimePay =
        otAmount !== undefined ? otAmount : ot !== undefined ? ot.hours * ot.rate : (slip.overtimePay ?? 0);
      return computeSlip({
        personType: "employee",
        userId: slip.userId ?? u?._id,
        name: u?.name ?? slip.name,
        employeeNumber: u?.employeeNumber ?? slip.employeeNumber,
        role: u?.role ?? slip.role,
        employmentType: u?.employmentType ?? "permanent",
        basicSalary: basicMap.get(key) ?? (u?.basicSalary ?? slip.basicSalary),
        allowances: allowanceMap.get(key) ?? slip.allowances,
        perDiem: perDiemMap.get(key) ?? slip.perDiem ?? 0,
        overtimeHours: ot?.hours ?? slip.overtimeHours ?? 0,
        overtimeRate: ot?.rate ?? slip.overtimeRate ?? 0,
        overtimePay,
        bonus: bonusMap.get(key) ?? slip.bonus ?? 0,
        leaveDaysPayout: leaveMap.get(key) ?? slip.leaveDaysPayout,
        helb: helbMap.get(key) ?? (u?.helbDeduction ?? slip.helb),
        loanRepayment: slip.loanRepayment ?? 0,
        loanId: slip.loanId,
        otherDeductions: otherMap.get(key) ?? slip.otherDeductions ?? 0,
        statutory: true,
      });
    });

    await ctx.db.patch(args.id, { payslips });
    return { id: args.id, count: payslips.length };
  },
});

export const deletePayroll = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("payrolls") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const payroll = await ctx.db.get(args.id);
    if (!payroll || payroll.orgId !== args.orgId) throw new Error("Payroll not found");

    // Restore any staff-loan recoveries this run applied.
    for (const slip of payroll.payslips) {
      if (slip.loanId && (slip.loanRepayment ?? 0) > 0) {
        const loan = await ctx.db.get(slip.loanId);
        if (loan) {
          await ctx.db.patch(loan._id, {
            balance: round2(loan.balance + (slip.loanRepayment ?? 0)),
            active: true,
          });
        }
      }
    }
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});

// ------------------------------- Computation -------------------------------

type UserLike = {
  _id: any;
  name: string;
  employeeNumber?: string;
  role: string;
  basicSalary?: number;
  employmentType?: "permanent" | "permanent_pensionable";
  helbDeduction?: number;
  active: boolean;
};

type SlipInput = {
  userId?: any;
  casualId?: any;
  personType: "employee" | "casual";
  name: string;
  employeeNumber?: string;
  role: string;
  employmentType?: "permanent" | "permanent_pensionable" | "casual";
  basicSalary: number;
  allowances: number;
  perDiem: number;
  overtimeHours?: number;
  overtimeRate?: number;
  overtimePay: number;
  bonus: number;
  leaveDaysPayout: number;
  daysWorked?: number;
  dailyRate?: number;
  helb: number;
  loanRepayment: number;
  loanId?: any;
  otherDeductions: number;
  statutory: boolean;
};

function computeSlip(o: SlipInput) {
  const basicSalary = round2(o.basicSalary);
  const allowances = round2(o.allowances);
  const perDiem = round2(o.perDiem ?? 0);
  const overtimePay = round2(o.overtimePay ?? 0);
  const bonus = round2(o.bonus ?? 0);
  const leaveDaysPayout = round2(o.leaveDaysPayout);

  // Taxable earnings: everything except the per-diem reimbursement.
  const statutoryBase = basicSalary + allowances + overtimePay + bonus + leaveDaysPayout;
  const grossPay = statutoryBase + perDiem;
  const applyStatutory = o.personType === "employee" || o.statutory;

  let nssfTier1 = 0;
  let nssfTier2 = 0;
  let sha = 0;
  let housingLevy = 0;
  let pension = 0;
  let taxablePay = 0;
  let incomeTax = 0;
  let personalRelief = 0;
  let paye = 0;
  let helb = 0;
  let loanRepayment = 0;
  let otherDeductions = 0;

  if (applyStatutory) {
    const tiers = nssfTiers(statutoryBase);
    nssfTier1 = tiers.tier1;
    nssfTier2 = tiers.tier2;
    sha = Math.max(statutoryBase * SHIF_RATE, statutoryBase > 0 ? SHIF_MINIMUM : 0);
    housingLevy = statutoryBase * HOUSING_RATE;
    pension =
      o.employmentType === "permanent_pensionable"
        ? Math.min(statutoryBase * PENSION_RATE, PENSION_MONTHLY_CAP)
        : 0;
    const chargeable = statutoryBase - nssfTier1 - nssfTier2 - sha - housingLevy - pension;
    const tax = calcTax(chargeable);
    taxablePay = chargeable;
    incomeTax = tax.incomeTax;
    personalRelief = tax.personalRelief;
    paye = tax.paye;
    helb = o.helb ?? 0;
    loanRepayment = o.loanRepayment ?? 0;
    otherDeductions = o.otherDeductions ?? 0;
  }

  const nssf = nssfTier1 + nssfTier2;
  const totalDeductions = paye + nssf + sha + housingLevy + pension + helb + loanRepayment + otherDeductions;
  const netPay = grossPay - totalDeductions;

  return {
    userId: o.userId,
    casualId: o.casualId,
    personType: o.personType,
    name: o.name,
    employeeNumber: o.employeeNumber,
    role: o.role,
    employmentType: o.employmentType ?? (o.personType === "casual" ? "casual" : "permanent"),
    basicSalary,
    allowances,
    perDiem,
    overtimeHours: o.overtimeHours ?? 0,
    overtimeRate: o.overtimeRate ?? 0,
    overtimePay,
    bonus,
    leaveDaysPayout,
    daysWorked: o.daysWorked,
    dailyRate: o.dailyRate,
    statutory: applyStatutory,
    grossPay: round2(grossPay),
    nssf: round2(nssf),
    nssfTier1: round2(nssfTier1),
    nssfTier2: round2(nssfTier2),
    sha: round2(sha),
    housingLevy: round2(housingLevy),
    pension: round2(pension),
    taxablePay: round2(taxablePay),
    incomeTax: round2(incomeTax),
    personalRelief: round2(personalRelief),
    paye: round2(paye),
    helb: round2(helb),
    loanRepayment: round2(loanRepayment),
    loanId: o.loanId,
    otherDeductions: round2(otherDeductions),
    totalDeductions: round2(totalDeductions),
    netPay: round2(netPay),
  };
}

function buildPayslips(
  users: UserLike[],
  allowances: Array<{ userId: any; amount: number }>,
  perDiems: Array<{ userId: any; amount: number }>,
  overtime: Array<{ userId: any; hours: number; rate: number }>,
  bonuses: Array<{ userId: any; amount: number }>,
  otherDeductions: Array<{ userId: any; amount: number }>,
  leaveDaysPayouts: Array<{ userId: any; amount: number }>,
  loanMap: Map<string, number>,
  loanIdMap: Map<string, string>,
  selected?: Set<any>
) {
  const allowanceMap = new Map(allowances.map((a) => [a.userId, a.amount]));
  const perDiemMap = new Map(perDiems.map((a) => [a.userId, a.amount]));
  const overtimeMap = new Map(overtime.map((a) => [a.userId, a]));
  const bonusMap = new Map(bonuses.map((a) => [a.userId, a.amount]));
  const otherMap = new Map(otherDeductions.map((a) => [a.userId, a.amount]));
  const leaveMap = new Map(leaveDaysPayouts.map((a) => [a.userId, a.amount]));
  return users
    .filter((u) => u.active && typeof u.basicSalary === "number" && u.basicSalary > 0)
    .filter((u) => (selected && selected.size > 0 ? selected.has(u._id) : true))
    .map((u) => {
      const ot = overtimeMap.get(u._id);
      return computeSlip({
        personType: "employee",
        userId: u._id,
        name: u.name,
        employeeNumber: u.employeeNumber,
        role: u.role,
        employmentType: u.employmentType,
        basicSalary: u.basicSalary!,
        allowances: allowanceMap.get(u._id) ?? 0,
        perDiem: perDiemMap.get(u._id) ?? 0,
        overtimeHours: ot?.hours ?? 0,
        overtimeRate: ot?.rate ?? 0,
        overtimePay: ot ? ot.hours * ot.rate : 0,
        bonus: bonusMap.get(u._id) ?? 0,
        leaveDaysPayout: leaveMap.get(u._id) ?? 0,
        helb: u.helbDeduction ?? 0,
        loanRepayment: loanMap.get(u._id as string) ?? 0,
        loanId: loanIdMap.get(u._id as string),
        otherDeductions: otherMap.get(u._id) ?? 0,
        statutory: true,
      });
    });
}
