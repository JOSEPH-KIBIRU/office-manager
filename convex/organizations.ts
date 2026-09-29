import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret } from "./lib";

export const getOrganization = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");
    let logoUrl: string | null = null;
    if (org.logoFileId) {
      logoUrl = await ctx.storage.getUrl(org.logoFileId);
    }
    return {
      id: org._id,
      name: org.name,
      slug: org.slug,
      active: org.active,
      deletedAt: org.deletedAt ?? null,
      logoFileId: org.logoFileId ?? null,
      logoUrl,
      address: org.address ?? "",
      city: org.city ?? "",
      phone: org.phone ?? "",
      email: org.email ?? "",
      taxNumber: org.taxNumber ?? "",
      website: org.website ?? "",
      paymentDetails: org.paymentDetails ?? "",
      invoiceNotes: org.invoiceNotes ?? "",
      invoiceTerms: org.invoiceTerms ?? "",
      workingDays: org.workingDays ?? [1, 2, 3, 4, 5],
      etimsEnabled: org.etimsEnabled ?? false,
      etimsEnv: org.etimsEnv ?? "sandbox",
      etimsBaseUrl: org.etimsBaseUrl ?? "",
      etimsTin: org.etimsTin ?? "",
      etimsBhfId: org.etimsBhfId ?? "",
      etimsDeviceSerial: org.etimsDeviceSerial ?? "",
      etimsApiKey: org.etimsApiKey ?? "",
      etimsHasSecret: !!org.etimsApiSecret,
      remindersEnabled: org.remindersEnabled ?? true,
      reminderIntervalDays: org.reminderIntervalDays ?? 3,
      reminderMax: org.reminderMax ?? 4,
      leaveEntitlement: org.leaveEntitlement ?? 21,
      leaveCarryOverMax: org.leaveCarryOverMax ?? 0,
      leaveEncashment: org.leaveEncashment ?? false,
      workStartTime: org.workStartTime ?? "08:00",
      workEndTime: org.workEndTime ?? "17:00",
      graceMinutes: org.graceMinutes ?? 15,
    };
  },
});

/** Server-only: full eTIMS config including the secret (never sent to the browser). */
export const getEtimsConfig = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;
    return {
      enabled: org.etimsEnabled ?? false,
      env: org.etimsEnv ?? "sandbox",
      baseUrl: org.etimsBaseUrl ?? "",
      tin: org.etimsTin ?? "",
      bhfId: org.etimsBhfId ?? "",
      deviceSerial: org.etimsDeviceSerial ?? "",
      apiKey: org.etimsApiKey ?? "",
      apiSecret: org.etimsApiSecret ?? "",
    };
  },
});

export const updateOrganization = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    name: v.optional(v.string()),
    logoFileId: v.optional(v.union(v.id("_storage"), v.null())),
    address: v.optional(v.union(v.string(), v.null())),
    city: v.optional(v.union(v.string(), v.null())),
    phone: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    taxNumber: v.optional(v.union(v.string(), v.null())),
    website: v.optional(v.union(v.string(), v.null())),
    paymentDetails: v.optional(v.union(v.string(), v.null())),
    invoiceNotes: v.optional(v.union(v.string(), v.null())),
    invoiceTerms: v.optional(v.union(v.string(), v.null())),
    workingDays: v.optional(v.array(v.number())),
    etimsEnabled: v.optional(v.boolean()),
    etimsEnv: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
    etimsBaseUrl: v.optional(v.union(v.string(), v.null())),
    etimsTin: v.optional(v.union(v.string(), v.null())),
    etimsBhfId: v.optional(v.union(v.string(), v.null())),
    etimsDeviceSerial: v.optional(v.union(v.string(), v.null())),
    etimsApiKey: v.optional(v.union(v.string(), v.null())),
    etimsApiSecret: v.optional(v.union(v.string(), v.null())),
    remindersEnabled: v.optional(v.boolean()),
    reminderIntervalDays: v.optional(v.number()),
    reminderMax: v.optional(v.number()),
    leaveEntitlement: v.optional(v.number()),
    leaveCarryOverMax: v.optional(v.number()),
    leaveEncashment: v.optional(v.boolean()),
    workStartTime: v.optional(v.union(v.string(), v.null())),
    workEndTime: v.optional(v.union(v.string(), v.null())),
    graceMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org || !org.active) throw new Error("Organization not found or inactive");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      if (!args.name.trim()) throw new Error("Company name is required");
      patch.name = args.name.trim();
    }
    if (args.logoFileId !== undefined) patch.logoFileId = args.logoFileId;
    if (args.address !== undefined) patch.address = (args.address ?? "").trim() || undefined;
    if (args.city !== undefined) patch.city = (args.city ?? "").trim() || undefined;
    if (args.phone !== undefined) patch.phone = (args.phone ?? "").trim() || undefined;
    if (args.email !== undefined) patch.email = (args.email ?? "").trim() || undefined;
    if (args.taxNumber !== undefined) patch.taxNumber = (args.taxNumber ?? "").trim() || undefined;
    if (args.website !== undefined) patch.website = (args.website ?? "").trim() || undefined;
    if (args.paymentDetails !== undefined) patch.paymentDetails = (args.paymentDetails ?? "").trim() || undefined;
    if (args.invoiceNotes !== undefined) patch.invoiceNotes = (args.invoiceNotes ?? "").trim() || undefined;
    if (args.invoiceTerms !== undefined) patch.invoiceTerms = (args.invoiceTerms ?? "").trim() || undefined;
    if (args.workingDays !== undefined) {
      const days = Array.from(new Set(args.workingDays.filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b);
      if (days.length === 0) throw new Error("Select at least one working day");
      patch.workingDays = days;
    }
    if (args.etimsEnabled !== undefined) patch.etimsEnabled = args.etimsEnabled;
    if (args.etimsEnv !== undefined) patch.etimsEnv = args.etimsEnv;
    if (args.etimsBaseUrl !== undefined) patch.etimsBaseUrl = (args.etimsBaseUrl ?? "").trim() || undefined;
    if (args.etimsTin !== undefined) patch.etimsTin = (args.etimsTin ?? "").trim() || undefined;
    if (args.etimsBhfId !== undefined) patch.etimsBhfId = (args.etimsBhfId ?? "").trim() || undefined;
    if (args.etimsDeviceSerial !== undefined) patch.etimsDeviceSerial = (args.etimsDeviceSerial ?? "").trim() || undefined;
    if (args.etimsApiKey !== undefined) patch.etimsApiKey = (args.etimsApiKey ?? "").trim() || undefined;
    if (args.etimsApiSecret !== undefined) patch.etimsApiSecret = (args.etimsApiSecret ?? "").trim() || undefined;
    if (args.remindersEnabled !== undefined) patch.remindersEnabled = args.remindersEnabled;
    if (args.reminderIntervalDays !== undefined) {
      patch.reminderIntervalDays = Math.min(60, Math.max(1, Math.round(args.reminderIntervalDays)));
    }
    if (args.reminderMax !== undefined) {
      patch.reminderMax = Math.min(20, Math.max(1, Math.round(args.reminderMax)));
    }
    if (args.leaveEntitlement !== undefined) {
      patch.leaveEntitlement = Math.min(365, Math.max(0, Math.round(args.leaveEntitlement)));
    }
    if (args.leaveCarryOverMax !== undefined) {
      patch.leaveCarryOverMax = Math.min(365, Math.max(0, Math.round(args.leaveCarryOverMax)));
    }
    if (args.leaveEncashment !== undefined) patch.leaveEncashment = args.leaveEncashment;
    if (args.workStartTime !== undefined) {
      const t = (args.workStartTime ?? "").trim();
      if (t && !/^\d{2}:\d{2}$/.test(t)) throw new Error("Work start time must be in HH:MM format");
      patch.workStartTime = t || undefined;
    }
    if (args.workEndTime !== undefined) {
      const t = (args.workEndTime ?? "").trim();
      if (t && !/^\d{2}:\d{2}$/.test(t)) throw new Error("Work end time must be in HH:MM format");
      patch.workEndTime = t || undefined;
    }
    if (args.graceMinutes !== undefined) {
      patch.graceMinutes = Math.min(120, Math.max(0, Math.round(args.graceMinutes)));
    }

    await ctx.db.patch(args.orgId, patch as never);
    return true;
  },
});