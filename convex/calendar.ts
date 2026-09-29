import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireMember, tsNow } from "./lib";

const providerValidator = v.union(v.literal("google"), v.literal("microsoft"));

/** Create or replace a user's calendar connection for a provider. */
export const upsertConnection = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: providerValidator,
    email: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    const existing = await ctx.db
      .query("calendarConnections")
      .withIndex("by_user_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .first();
    const now = tsNow();
    if (existing) {
      await ctx.db.patch(existing._id, {
        orgId: args.orgId,
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken ?? existing.refreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope,
        status: "active",
        lastError: undefined,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("calendarConnections", {
      orgId: args.orgId,
      userId: args.userId,
      provider: args.provider,
      email: args.email,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
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
    return ctx.db
      .query("calendarConnections")
      .withIndex("by_user_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .first();
  },
});

/** All of a user's connections (safe fields only — never returns tokens to callers). */
export const listMyConnections = query({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db
      .query("calendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return rows
      .filter((r) => r.orgId === args.orgId)
      .map((r) => ({
        id: r._id,
        provider: r.provider,
        email: r.email ?? null,
        status: r.status,
        lastError: r.lastError ?? null,
        updated_at: new Date(r.updatedAt).toISOString().replace("T", " ").slice(0, 19),
      }));
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
      .query("calendarConnections")
      .withIndex("by_user_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .first();
    if (conn) await ctx.db.delete(conn._id);
    // Clear event mappings so a future reconnect re-creates events.
    const maps = await ctx.db
      .query("calendarEvents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const m of maps) {
      if (m.provider === args.provider) await ctx.db.delete(m._id);
    }
    return true;
  },
});

/** Update tokens/expiry after a refresh, or flag an error. */
export const updateConnectionTokens = mutation({
  args: {
    secret: v.string(),
    id: v.id("calendarConnections"),
    accessToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    refreshToken: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("error"))),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.accessToken !== undefined) patch.accessToken = args.accessToken;
    if (args.expiresAt !== undefined) patch.expiresAt = args.expiresAt;
    if (args.refreshToken !== undefined) patch.refreshToken = args.refreshToken;
    if (args.status !== undefined) patch.status = args.status;
    if (args.lastError !== undefined) patch.lastError = args.lastError;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const getEventMap = query({
  args: { secret: v.string(), sourceType: v.string(), sourceId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db
      .query("calendarEvents")
      .withIndex("by_source", (q) => q.eq("sourceType", args.sourceType).eq("sourceId", args.sourceId))
      .collect();
    return rows.filter((r) => r.userId === args.userId);
  },
});

export const upsertEventMap = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: v.string(),
    sourceType: v.string(),
    sourceId: v.string(),
    externalEventId: v.string(),
    calendarId: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const existing = await ctx.db
      .query("calendarEvents")
      .withIndex("by_source", (q) => q.eq("sourceType", args.sourceType).eq("sourceId", args.sourceId))
      .collect();
    const mine = existing.find((r) => r.userId === args.userId && r.provider === args.provider);
    if (mine) {
      await ctx.db.patch(mine._id, {
        externalEventId: args.externalEventId,
        calendarId: args.calendarId,
        updatedAt: tsNow(),
      });
      return mine._id;
    }
    return ctx.db.insert("calendarEvents", {
      orgId: args.orgId,
      userId: args.userId,
      provider: args.provider,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      externalEventId: args.externalEventId,
      calendarId: args.calendarId,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
  },
});

export const deleteEventMap = mutation({
  args: { secret: v.string(), id: v.id("calendarEvents") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await ctx.db.delete(args.id);
    return true;
  },
});

export const enqueueJob = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: v.string(),
    sourceType: v.string(),
    sourceId: v.string(),
    action: v.union(v.literal("upsert"), v.literal("delete")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const now = tsNow();
    // Collapse duplicate pending work for the same source+user.
    const existing = await ctx.db
      .query("calendarSyncJobs")
      .withIndex("by_source", (q) => q.eq("sourceType", args.sourceType).eq("sourceId", args.sourceId))
      .collect();
    const pending = existing.find(
      (j) => j.userId === args.userId && j.provider === args.provider && (j.status === "pending" || j.status === "processing")
    );
    if (pending) {
      await ctx.db.patch(pending._id, { action: args.action, status: "pending", runAt: now, updatedAt: now });
      return pending._id;
    }
    return ctx.db.insert("calendarSyncJobs", {
      orgId: args.orgId,
      userId: args.userId,
      provider: args.provider,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      action: args.action,
      status: "pending",
      attempts: 0,
      runAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Enqueue work for every calendar this user has connected. */
export const enqueueForUser = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    sourceType: v.string(),
    sourceId: v.string(),
    action: v.union(v.literal("upsert"), v.literal("delete")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const connections = await ctx.db
      .query("calendarConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const active = connections.filter((c) => c.orgId === args.orgId);
    const now = tsNow();
    let queued = 0;
    for (const conn of active) {
      const existing = await ctx.db
        .query("calendarSyncJobs")
        .withIndex("by_source", (q) => q.eq("sourceType", args.sourceType).eq("sourceId", args.sourceId))
        .collect();
      const pending = existing.find(
        (j) => j.userId === args.userId && j.provider === conn.provider && (j.status === "pending" || j.status === "processing")
      );
      if (pending) {
        await ctx.db.patch(pending._id, { action: args.action, status: "pending", runAt: now, updatedAt: now });
      } else {
        await ctx.db.insert("calendarSyncJobs", {
          orgId: args.orgId,
          userId: args.userId,
          provider: conn.provider,
          sourceType: args.sourceType,
          sourceId: args.sourceId,
          action: args.action,
          status: "pending",
          attempts: 0,
          runAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
      queued++;
    }
    return queued;
  },
});

/** Claim up to `limit` due jobs (marks them processing and bumps attempts). */
export const claimJobs = mutation({
  args: { secret: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const now = tsNow();
    const due = await ctx.db
      .query("calendarSyncJobs")
      .withIndex("by_status_runAt", (q) => q.eq("status", "pending").lte("runAt", now))
      .take(Math.max(1, Math.min(25, args.limit)));
    for (const j of due) {
      await ctx.db.patch(j._id, { status: "processing", attempts: j.attempts + 1, updatedAt: now });
    }
    return due;
  },
});

export const finishJob = mutation({
  args: {
    secret: v.string(),
    id: v.id("calendarSyncJobs"),
    ok: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const job = await ctx.db.get(args.id);
    if (!job) return false;
    const now = tsNow();
    if (args.ok) {
      await ctx.db.patch(args.id, { status: "done", lastError: undefined, updatedAt: now });
      return true;
    }
    // Exponential backoff, give up after 5 attempts.
    if (job.attempts >= 5) {
      await ctx.db.patch(args.id, { status: "error", lastError: args.error, updatedAt: now });
      return true;
    }
    const backoff = Math.min(60 * 60 * 1000, 30_000 * Math.pow(2, job.attempts));
    await ctx.db.patch(args.id, {
      status: "pending",
      lastError: args.error,
      runAt: now + backoff,
      updatedAt: now,
    });
    return true;
  },
});
