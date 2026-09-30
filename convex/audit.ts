import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";
import { assertSuperAdmin } from "./superadmin";

/**
 * Immutable audit trail. Every entry records who acted, what they did, and on
 * which record, scoped to an organization. Entries are append-only; callers
 * only ever insert and read.
 *
 * Platform (super-admin) actions are recorded against the target company so the
 * platform console can show a full per-company trail, but they are hidden from
 * the company's own audit log (see `list`).
 */

const PLATFORM_ROLE = "super_admin";

export interface AuditEntryInput {
  actorId?: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  targetType?: string;
  targetId?: string;
  summary: string;
  metadata?: unknown;
  ip?: string;
}

/** Insert an audit entry from inside another Convex mutation. */
export async function recordAudit(ctx: MutationCtx, orgId: string, e: AuditEntryInput) {
  await ctx.db.insert("auditLogs", {
    orgId: orgId as never,
    actorId: (e.actorId as never) || undefined,
    actorName: e.actorName,
    actorRole: e.actorRole,
    action: e.action,
    module: e.module,
    targetType: e.targetType,
    targetId: e.targetId,
    summary: e.summary,
    metadata: e.metadata,
    ip: e.ip,
    createdAt: tsNow(),
  });
}

export const record = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.optional(v.id("users")),
    actorName: v.string(),
    actorRole: v.string(),
    action: v.string(),
    module: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.any()),
    ip: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await recordAudit(ctx, args.orgId, {
      actorId: args.actorId as string | undefined,
      actorName: args.actorName,
      actorRole: args.actorRole,
      action: args.action,
      module: args.module,
      targetType: args.targetType,
      targetId: args.targetId,
      summary: args.summary,
      metadata: args.metadata,
      ip: args.ip,
    });
    return { ok: true };
  },
});

const ACTION_SET = [
  "login",
  "user.create",
  "user.update",
  "user.role_change",
  "user.deactivate",
  "user.delete",
  "company.create",
  "company.suspend",
  "company.reactivate",
  "company.archive",
  "company.restore",
  "company.delete",
  "backup.create",
  "backup.delete",
  "backup.restore",
  "permissions.update",
  "features.update",
  "subscriptions.update",
  "subscriptions.lifecycle",
  "payroll.run",
  "invoice.create",
  "invoice.delete",
  "leave.approve",
  "leave.reject",
] as const;

interface ListArgs {
  orgId: string;
  action?: string;
  module?: string;
  actorId?: string;
  limit?: number;
  before?: number;
}

/**
 * Shared listing. `includePlatform` controls whether super-admin actions are
 * returned: the company-facing query never returns them, the platform console
 * query does.
 */
async function collectLogs(ctx: any, args: ListArgs, includePlatform: boolean) {
  const limit = Math.min(Math.max(args.limit ?? 200, 1), 1000);
  const rows = await ctx.db
    .query("auditLogs")
    .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
    .collect();

  let filtered = includePlatform
    ? rows
    : rows.filter((r: any) => r.actorRole !== PLATFORM_ROLE);
  if (args.action) filtered = filtered.filter((r: any) => r.action === args.action);
  if (args.module) filtered = filtered.filter((r: any) => r.module === args.module);
  if (args.actorId) filtered = filtered.filter((r: any) => r.actorId === args.actorId);

  filtered.sort((a: any, b: any) => b.createdAt - a.createdAt);
  const afterCursor =
    args.before !== undefined ? filtered.filter((r: any) => r.createdAt < args.before!) : filtered;
  const page = afterCursor.slice(0, limit);

  return {
    total: filtered.length,
    items: page.map((r: any) => ({
      id: r._id,
      actorId: r.actorId ?? null,
      actorName: r.actorName,
      actorRole: r.actorRole,
      action: r.action,
      module: r.module,
      targetType: r.targetType ?? null,
      targetId: r.targetId ?? null,
      summary: r.summary,
      metadata: r.metadata ?? null,
      ip: r.ip ?? null,
      createdAt: r.createdAt,
    })),
    nextBefore: page.length === limit ? page[page.length - 1].createdAt : null,
  };
}

/** Company-facing audit log. Platform (super-admin) actions are excluded. */
export const list = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    action: v.optional(v.string()),
    module: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return collectLogs(ctx, args, false);
  },
});

/**
 * Platform-console audit trail for one company. Includes platform actions so a
 * super admin can see everything that happened to the company.
 */
export const adminList = query({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    orgId: v.id("organizations"),
    action: v.optional(v.string()),
    module: v.optional(v.string()),
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    return collectLogs(ctx, args, true);
  },
});

/** Distinct modules + actions present in the log (for filter dropdowns). */
export const facets = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const modules = new Set<string>();
    const actions = new Set<string>();
    for (const r of rows) {
      if (r.actorRole === PLATFORM_ROLE) continue;
      modules.add(r.module);
      actions.add(r.action);
    }
    return {
      modules: [...modules].sort(),
      actions: [...actions].sort(),
      knownActions: ACTION_SET as unknown as string[],
    };
  },
});
