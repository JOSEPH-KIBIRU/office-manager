import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";
import { slugify } from "./orgs";
import { ORG_TABLES, takeForOrg, hasAnyForOrg } from "./orgData";
import { kenyaHolidays } from "./keHolidays";

/** Only platform super_admins may reach these. Verifies the caller account. */
export async function assertSuperAdmin(ctx: any, superAdminId: string) {
  const sa = await ctx.db.get(superAdminId);
  if (!sa || sa.role !== "super_admin" || !sa.active) {
    throw new Error("Platform owner access required");
  }
  return sa;
}

export const listAllOrganizations = query({
  args: { secret: v.string(), superAdminId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const orgs = await ctx.db.query("organizations").collect();
    const fmt = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
    const result = [] as Array<{
      id: string;
      name: string;
      slug: string;
      active: boolean;
      archived: boolean;
      deleted_at: string | null;
      users: number;
      admin_details: Array<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
        last_login_at: string | null;
        last_login_ms: number | null;
        must_change_password: boolean;
        active: boolean;
      }>;
      last_accessed_at: string | null;
      last_accessed_ms: number | null;
      created_at: string;
      created_ms: number;
    }>;
    for (const o of [...orgs].sort((a, b) => a.createdAt - b.createdAt)) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_org", (q) => q.eq("orgId", o._id))
        .collect();
      const admins = users.filter((u) => u.role === "admin");
      result.push({
        id: o._id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        archived: !!o.deletedAt,
        deleted_at: o.deletedAt ? fmt(o.deletedAt) : null,
        users: users.length,
        admin_details: admins.map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone ?? null,
          last_login_at: u.lastLoginAt ? fmt(u.lastLoginAt) : null,
          last_login_ms: u.lastLoginAt ?? null,
          must_change_password: !!u.mustChangePassword,
          active: u.active,
        })),
        last_accessed_at: o.lastAccessedAt ? fmt(o.lastAccessedAt) : null,
        last_accessed_ms: o.lastAccessedAt ?? null,
        created_at: fmt(o.createdAt),
        created_ms: o.createdAt,
      });
    }
    return result;
  },
});

/** Superadmin resets a company admin's password (temporary password flow). */
export const resetAdminPassword = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    userId: v.id("users"),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role === "super_admin") {
      throw new Error("Platform owner passwords cannot be reset from here");
    }
    await ctx.db.patch(user._id, { passwordHash: args.passwordHash, mustChangePassword: true });
    return { id: user._id, name: user.name, email: user.email, phone: user.phone ?? null };
  },
});

/** Platform owner creates a new company org and its first admin account. */
export const createCompany = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    name: v.string(),
    adminName: v.string(),
    adminEmail: v.string(),
    adminPasswordHash: v.string(),
    workingDays: v.optional(v.array(v.number())),
    customRoles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const sa = await assertSuperAdmin(ctx, args.superAdminId);
    void sa;

    const slug = slugify(args.name);
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existingOrg) throw new Error(`An organization with slug "${slug}" already exists`);

    const email = args.adminEmail.toLowerCase().trim();
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existingUser) throw new Error("A user with this email already exists");

    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug,
      active: true,
      createdAt: tsNow(),
      workingDays:
        args.workingDays && args.workingDays.length
          ? Array.from(new Set(args.workingDays.filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b)
          : [1, 2, 3, 4, 5],
      customRoles: (args.customRoles ?? [])
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label) => ({
          key: slugify(label).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "role",
          label,
        }))
        .filter((r, i, arr) => arr.findIndex((x) => x.key === r.key) === i),
    });

    const adminId = await ctx.db.insert("users", {
      orgId,
      name: args.adminName,
      email,
      role: "admin",
      passwordHash: args.adminPasswordHash,
      leaveBalance: 21,
      mustChangePassword: true,
      active: true,
      createdAt: tsNow(),
    });

    // Seed Kenya's public holidays (fixed + Easter + Eid) for this year and
    // next so leave is deducted in actual working days out of the box.
    const thisYear = new Date().getFullYear();
    for (const yr of [thisYear, thisYear + 1]) {
      for (const h of kenyaHolidays(yr)) {
        await ctx.db.insert("holidays", { orgId, date: h.date, name: h.name, createdAt: tsNow() });
      }
    }

    return { orgId, adminId, adminEmail: email };
  },
});

export const setCompanyActive = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    orgId: v.id("organizations"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    await ctx.db.patch(args.orgId, { active: args.active });
    return { orgId: args.orgId, active: args.active };
  },
});

/** Soft delete: archive a company (hide + block login) while keeping its data. */
export const softDeleteCompany = mutation({
  args: { secret: v.string(), superAdminId: v.id("users"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Company not found");
    if (org.slug === "__platform") throw new Error("The platform workspace cannot be archived");
    await ctx.db.patch(args.orgId, { deletedAt: tsNow(), deletedBy: args.superAdminId, active: false });
    return { orgId: args.orgId, archived: true };
  },
});

/** Restore a soft-deleted (archived) company. */
export const restoreCompany = mutation({
  args: { secret: v.string(), superAdminId: v.id("users"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Company not found");
    await ctx.db.patch(args.orgId, { deletedAt: undefined, deletedBy: undefined, active: true });
    return { orgId: args.orgId, archived: false };
  },
});

/**
 * Hard delete, processed in bounded batches so it never exceeds Convex
 * transaction limits. Call repeatedly until `done` is true. The organization
 * row is removed only once every company-scoped table is empty.
 */
export const purgeCompanyBatch = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Company not found");
    if (org.slug === "__platform") throw new Error("The platform workspace cannot be deleted");

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 300);
    let deleted = 0;

    for (const table of ORG_TABLES) {
      const rows = await takeForOrg(ctx, table, args.orgId, limit);
      for (const r of rows as any[]) {
        if (table === "storedFiles" && r.storageId) {
          try {
            await ctx.storage.delete(r.storageId);
          } catch {
            /* ignore */
          }
        }
        if (table === "minutes" && r.fileId) {
          try {
            await ctx.storage.delete(r.fileId);
          } catch {
            /* ignore */
          }
        }
        await ctx.db.delete(r._id);
        deleted++;
      }
    }

    const more = await hasAnyForOrg(ctx, args.orgId);
    if (!more) {
      if (org.logoFileId) {
        try {
          await ctx.storage.delete(org.logoFileId);
        } catch {
          /* ignore */
        }
      }
      await ctx.db.delete(args.orgId);
    }
    return { deleted, done: !more };
  },
});

const ANNOUNCEMENT_TYPES = ["info", "maintenance", "training", "offer", "outage"] as const;

/** Active platform announcements shown to end users. Public-ish read (secret only). */
export const listActiveAnnouncements = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const items = await ctx.db
      .query("announcements")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    return items
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((a) => ({
        id: a._id,
        message: a.message,
        type: a.type,
        link: a.link ?? null,
        color: a.color ?? null,
      }));
  },
});

/** Superadmin lists all announcements, newest first. */
export const listAnnouncements = query({
  args: { secret: v.string(), superAdminId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const items = await ctx.db.query("announcements").collect();
    return items
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((a) => ({
        id: a._id,
        message: a.message,
        type: a.type,
        link: a.link ?? null,
        active: a.active,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt ?? null,
        color: a.color ?? null,
      }));
  },
});

/** Superadmin creates a new announcement/post. */
export const createAnnouncement = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    message: v.string(),
    type: v.string(),
    link: v.optional(v.string()),
    active: v.boolean(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    if (!(ANNOUNCEMENT_TYPES as readonly string[]).includes(args.type)) {
      throw new Error("Invalid announcement type");
    }
    const id = await ctx.db.insert("announcements", {
      message: args.message,
      type: args.type as (typeof ANNOUNCEMENT_TYPES)[number],
      link: args.link || undefined,
      active: args.active,
      createdBy: args.superAdminId,
      createdAt: tsNow(),
      color: args.color || undefined,
    });
    return { id };
  },
});

/** Superadmin updates an announcement (message/type/link/active). */
export const updateAnnouncement = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    id: v.id("announcements"),
    message: v.optional(v.string()),
    type: v.optional(v.string()),
    link: v.optional(v.string()),
    active: v.optional(v.boolean()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Announcement not found");
    if (args.type && !(ANNOUNCEMENT_TYPES as readonly string[]).includes(args.type)) {
      throw new Error("Invalid announcement type");
    }
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.message !== undefined) patch.message = args.message;
    if (args.type !== undefined) patch.type = args.type;
    if (args.link !== undefined) patch.link = args.link || undefined;
    if (args.active !== undefined) patch.active = args.active;
    if (args.color !== undefined) patch.color = args.color || undefined;
    await ctx.db.patch(args.id, patch);
    return { id: args.id };
  },
});

/** Superadmin deletes an announcement. */
export const deleteAnnouncement = mutation({
  args: { secret: v.string(), superAdminId: v.id("users"), id: v.id("announcements") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Announcement not found");
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});
