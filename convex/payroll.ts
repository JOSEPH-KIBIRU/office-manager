import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, tsNow } from "./lib";
import { pushNotification } from "./notifications";

// ---- Kenya PAYE (annual) tax bands ----
const PAYEE_BANDS: Array<[number, number]> = [
  [0, 0.10],
  [288000, 0.25],
  [388000, 0.30],
  [6000000, 0.325],
  [9600000, 0.35],
];
const PERSONAL_RELIEF_MONTHLY = 2400;

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
    admin: v.optional(v.boolean()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const payroll = await ctx.db.get(args.id);
    if (!payroll || payroll.orgId !== args.orgId) throw new Error("Payroll not found");

    if (args.admin) {
      if (!args.userId) throw new Error("Employee required");
      const payslip = payroll.payslips.find((p) => p.userId === args.userId);
      if (!payslip) throw new Error("Payslip not found");
      return { id: args.id, month: payroll.month, year: payroll.year, ...payslip };
    }

    if (!args.userId) throw new Error("Employee required");
    const payslip = payroll.payslips.find(
      (p) => p.userId === args.userId
    );
    if (!payslip) throw new Error("Payslip not found");
    return { id: args.id, month: payroll.month, year: payroll.year, ...payslip };
  },
});

/** List the payslips belonging to a single user (their payslips across runs). */
export const listMyPayslips = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db
      .query("payrolls")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
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
    const rows = await ctx.db
      .query("payrolls")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
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
      payslips: payroll.payslips.map((p) => ({
        userId: p.userId,
        name: p.name,
        employeeNumber: p.employeeNumber ?? null,
        role: p.role,
        basicSalary: p.basicSalary,
        allowances: p.allowances,
        leaveDaysPayout: p.leaveDaysPayout,
        helb: p.helb,
        grossPay: p.grossPay,
        netPay: p.netPay,
        totalDeductions: p.totalDeductions,
      })),
    };
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
    leaveDaysPayouts: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    if (args.month < 1 || args.month > 12) throw new Error("Invalid month");
    if (args.year < 2000 || args.year > 2100) throw new Error("Invalid year");

    const existing = await ctx.db
      .query("payrolls")
      .withIndex("by_org_month_year", (q) =>
        q.eq("orgId", args.orgId).eq("month", args.month).eq("year", args.year)
      )
      .first();
    if (existing) throw new Error(`Payroll for ${args.month}/${args.year} already exists`);

    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const selected = new Set(args.employeeIds ?? []);
    const payslips = buildPayslips(ctx, users, args.allowances ?? [], args.leaveDaysPayouts ?? [], selected);

    const id = await ctx.db.insert("payrolls", {
      orgId: args.orgId,
      month: args.month,
      year: args.year,
      runBy: args.runBy,
      createdAt: tsNow(),
      payslips,
    });

    const MONTHS = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    for (const slip of payslips) {
      await pushNotification(ctx, args.orgId as unknown as string, {
        userId: slip.userId as unknown as string,
        type: "payroll",
        title: "Your payslip is ready",
        body: `Payslip for ${MONTHS[args.month - 1]} ${args.year} is available. Net pay KSh ${slip.netPay.toLocaleString("en-KE")}.`,
        link: "/my-payslips",
      });
    }

    return { id, count: payslips.length };
  },
});

export const updatePayroll = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("payrolls"),
    allowances: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    leaveDaysPayouts: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    basicSalaries: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
    helbDeductions: v.optional(v.array(v.object({ userId: v.id("users"), amount: v.number() }))),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const payroll = await ctx.db.get(args.id);
    if (!payroll || payroll.orgId !== args.orgId) throw new Error("Payroll not found");

    const allowanceMap = new Map((args.allowances ?? []).map((a) => [a.userId, a.amount]));
    const leaveMap = new Map((args.leaveDaysPayouts ?? []).map((a) => [a.userId, a.amount]));
    const basicMap = new Map((args.basicSalaries ?? []).map((a) => [a.userId, a.amount]));
    const helbMap = new Map((args.helbDeductions ?? []).map((a) => [a.userId, a.amount]));

    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const userMap = new Map(users.map((u) => [u._id, u]));

    // Keep existing slips, but recalc those the admin edited (or use provided values).
    const payslips = payroll.payslips.map((slip) => {
      const u = userMap.get(slip.userId);
      const basicSalary = basicMap.get(slip.userId) ?? (u?.basicSalary ?? slip.basicSalary);
      const allowances = allowanceMap.get(slip.userId) ?? slip.allowances;
      const leavePayout = leaveMap.get(slip.userId) ?? slip.leaveDaysPayout;
      const helb = helbMap.get(slip.userId) ?? (u?.helbDeduction ?? slip.helb);
      return computeSlip({
        userId: slip.userId,
        name: u?.name ?? slip.name,
        employeeNumber: u?.employeeNumber ?? slip.employeeNumber,
        role: u?.role ?? slip.role,
        basicSalary,
        allowances,
        leaveDaysPayout: leavePayout,
        helb,
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
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});

type UserLike = { _id: any; name: string; employeeNumber?: string; role: string; basicSalary?: number; helbDeduction?: number; active: boolean };
type SlipOverrides = {
  userId: any;
  name: string;
  employeeNumber?: string;
  role: string;
  basicSalary: number;
  allowances: number;
  leaveDaysPayout: number;
  helb: number;
};

function computeSlip(o: SlipOverrides) {
  const grossPay = o.basicSalary + o.allowances + o.leaveDaysPayout;

  // NSSF (6% of gross, uncapped), SHIF (2.75%) and Affordable Housing Levy (1.5%)
  // are all deducted from gross before income tax is calculated (chargeable income).
  const nssf = grossPay * 0.06;
  const sha = grossPay * 0.0275;
  const housingLevy = grossPay * 0.015;
  const helb = o.helb;

  const chargeable = grossPay - nssf - sha - housingLevy;
  const tax = calcTax(chargeable);

  const totalDeductions = tax.paye + nssf + sha + housingLevy + helb;
  const netPay = grossPay - totalDeductions;

  return {
    userId: o.userId,
    name: o.name,
    employeeNumber: o.employeeNumber,
    role: o.role,
    basicSalary: Math.round(o.basicSalary * 100) / 100,
    allowances: Math.round(o.allowances * 100) / 100,
    leaveDaysPayout: Math.round(o.leaveDaysPayout * 100) / 100,
    grossPay: Math.round(grossPay * 100) / 100,
    nssf: Math.round(nssf * 100) / 100,
    sha: Math.round(sha * 100) / 100,
    housingLevy: Math.round(housingLevy * 100) / 100,
    taxablePay: Math.round(chargeable * 100) / 100,
    incomeTax: Math.round(tax.incomeTax * 100) / 100,
    personalRelief: Math.round(tax.personalRelief * 100) / 100,
    paye: Math.round(tax.paye * 100) / 100,
    helb: Math.round(helb * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netPay: Math.round(netPay * 100) / 100,
  };
}

function buildPayslips(
  ctx: any,
  users: UserLike[],
  allowances: Array<{ userId: any; amount: number }>,
  leaveDaysPayouts: Array<{ userId: any; amount: number }>,
  selected?: Set<any>
) {
  const allowanceMap = new Map(allowances.map((a) => [a.userId, a.amount]));
  const leaveMap = new Map(leaveDaysPayouts.map((a) => [a.userId, a.amount]));
  return users
    .filter((u) => u.active && typeof u.basicSalary === "number" && u.basicSalary > 0)
    .filter((u) => (selected && selected.size > 0 ? selected.has(u._id) : true))
    .map((u) =>
      computeSlip({
        userId: u._id,
        name: u.name,
        employeeNumber: u.employeeNumber,
        role: u.role,
        basicSalary: u.basicSalary!,
        allowances: allowanceMap.get(u._id) ?? 0,
        leaveDaysPayout: leaveMap.get(u._id) ?? 0,
        helb: u.helbDeduction ?? 0,
      })
    );
}
