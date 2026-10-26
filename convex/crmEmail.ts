import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireMember, tsNow } from "./lib";

const providerValidator = v.union(v.literal("gmail"), v.literal("outlook"));

const summaryValidator = v.object({
  providerMessageId: v.string(),
  threadId: v.optional(v.string()),
  internetMessageId: v.optional(v.string()),
  direction: v.union(v.literal("inbound"), v.literal("outbound")),
  from: v.string(),
  to: v.array(v.string()),
  cc: v.optional(v.array(v.string())),
  subject: v.optional(v.string()),
  snippet: v.optional(v.string()),
  receivedAt: v.number(),
  hasAttachments: v.optional(v.boolean()),
});

export const upsertConnection = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: providerValidator,
    email: v.optional(v.string()),
    accessTokenEnc: v.string(),
    refreshTokenEnc: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    const existing = await ctx.db
      .query("crmEmailConnections")
      .withIndex("by_user_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .first();
    const now = tsNow();
    if (existing) {
      await ctx.db.patch(existing._id, {
        orgId: args.orgId,
        email: args.email,
        accessTokenEnc: args.accessTokenEnc,
        refreshTokenEnc: args.refreshTokenEnc ?? existing.refreshTokenEnc,
        expiresAt: args.expiresAt,
        scope: args.scope,
        status: "active",
        lastError: undefined,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("crmEmailConnections", {
      orgId: args.orgId,
      userId: args.userId,
      provider: args.provider,
      email: args.email,
      accessTokenEnc: args.accessTokenEnc,
      refreshTokenEnc: args.refreshTokenEnc,
      expiresAt: args.expiresAt,
      scope: args.scope,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getConnection = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: providerValidator,
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const conn = await ctx.db
      .query("crmEmailConnections")
      .withIndex("by_user_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .first();
    if (!conn || conn.orgId !== args.orgId) return null;
    return conn;
  },
});

/** Server-only (sync runner). Never exposed by an API route. */
export const getConnectionById = query({
  args: { secret: v.string(), id: v.id("crmEmailConnections") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return ctx.db.get(args.id);
  },
});

/** Safe fields only — tokens never leave Convex. */
export const listMyConnections = query({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db
      .query("crmEmailConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const out = [];
    for (const row of rows) {
      if (row.orgId !== args.orgId) continue;
      const state = await ctx.db
        .query("crmEmailSyncState")
        .withIndex("by_connection", (q) => q.eq("connectionId", row._id))
        .first();
      out.push({
        id: row._id,
        provider: row.provider,
        email: row.email ?? null,
        status: row.status,
        lastError: row.lastError ?? null,
        lastSyncedAt: state?.lastSyncedAt ?? null,
        updatedAt: row.updatedAt,
      });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Server-only: active connections for the sync runner. */
export const listConnectionsForSync = query({
  args: { secret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("crmEmailConnections").collect();
    return rows.filter((r) => r.status === "active").slice(0, Math.min(args.limit ?? 20, 100));
  },
});

export const disconnect = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: providerValidator,
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    const conn = await ctx.db
      .query("crmEmailConnections")
      .withIndex("by_user_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .first();
    if (!conn) return true;
    const states = await ctx.db
      .query("crmEmailSyncState")
      .withIndex("by_connection", (q) => q.eq("connectionId", conn._id))
      .collect();
    for (const s of states) await ctx.db.delete(s._id);
    await ctx.db.delete(conn._id);
    return true;
  },
});

export const updateConnectionTokens = mutation({
  args: {
    secret: v.string(),
    id: v.id("crmEmailConnections"),
    accessTokenEnc: v.optional(v.string()),
    refreshTokenEnc: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("error"))),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.accessTokenEnc !== undefined) patch.accessTokenEnc = args.accessTokenEnc;
    if (args.refreshTokenEnc !== undefined) patch.refreshTokenEnc = args.refreshTokenEnc;
    if (args.expiresAt !== undefined) patch.expiresAt = args.expiresAt;
    if (args.status !== undefined) patch.status = args.status;
    if (args.lastError !== undefined) patch.lastError = args.lastError;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const getSyncState = query({
  args: { secret: v.string(), connectionId: v.id("crmEmailConnections") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return ctx.db
      .query("crmEmailSyncState")
      .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId))
      .first();
  },
});

export const upsertSyncState = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    connectionId: v.id("crmEmailConnections"),
    provider: providerValidator,
    cursor: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    status: v.union(v.literal("idle"), v.literal("syncing"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const existing = await ctx.db
      .query("crmEmailSyncState")
      .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId))
      .first();
    const patch = {
      orgId: args.orgId,
      provider: args.provider,
      cursor: args.cursor,
      lastSyncedAt: args.lastSyncedAt,
      status: args.status,
      error: args.error,
      updatedAt: tsNow(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return ctx.db.insert("crmEmailSyncState", { connectionId: args.connectionId, ...patch });
  },
});

/**
 * Idempotent upsert of synced message metadata, and best-effort linking to a
 * CRM contact (by email) and company (by contact or email domain).
 */
export const upsertMessages = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    connectionId: v.id("crmEmailConnections"),
    provider: providerValidator,
    messages: v.array(summaryValidator),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const conn = await ctx.db.get(args.connectionId);
    if (!conn || conn.orgId !== args.orgId) throw new Error("Email connection not found");

    const contacts = await ctx.db
      .query("crmContacts")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const byEmail = new Map<string, any>();
    for (const c of contacts) if (c.email) byEmail.set(c.email.toLowerCase(), c);
    const companies = await ctx.db
      .query("crmCompanies")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const byDomain = new Map<string, any>();
    for (const c of companies) if (c.domain) byDomain.set(c.domain.toLowerCase(), c);

    const now = tsNow();
    let inserted = 0;
    let updated = 0;

    for (const m of args.messages) {
      const existing = await ctx.db
        .query("crmEmailMessages")
        .withIndex("by_org_provider_message", (q) =>
          q.eq("orgId", args.orgId).eq("provider", args.provider).eq("providerMessageId", m.providerMessageId)
        )
        .first();

      const counterpart = (m.direction === "inbound" ? m.from : m.to[0] ?? "").toLowerCase();
      const contact = counterpart ? byEmail.get(counterpart) : undefined;
      const domain = counterpart.includes("@") ? counterpart.split("@")[1] : "";
      const company = contact?.companyId
        ? companies.find((c) => c._id === contact.companyId)
        : domain
          ? byDomain.get(domain)
          : undefined;

      if (existing) {
        await ctx.db.patch(existing._id, {
          threadId: m.threadId,
          internetMessageId: m.internetMessageId,
          direction: m.direction,
          from: m.from,
          to: m.to,
          cc: m.cc,
          subject: m.subject,
          snippet: m.snippet,
          receivedAt: m.receivedAt,
          hasAttachments: m.hasAttachments,
          contactId: existing.contactId ?? contact?._id,
          companyId: existing.companyId ?? company?._id,
        });
        updated += 1;
      } else {
        await ctx.db.insert("crmEmailMessages", {
          orgId: args.orgId,
          connectionId: args.connectionId,
          provider: args.provider,
          providerMessageId: m.providerMessageId,
          threadId: m.threadId,
          internetMessageId: m.internetMessageId,
          direction: m.direction,
          from: m.from,
          to: m.to,
          cc: m.cc,
          subject: m.subject,
          snippet: m.snippet,
          receivedAt: m.receivedAt,
          hasAttachments: m.hasAttachments,
          contactId: contact?._id,
          companyId: company?._id,
          createdAt: now,
        });
        inserted += 1;
      }
    }

    return { inserted, updated };
  },
});
