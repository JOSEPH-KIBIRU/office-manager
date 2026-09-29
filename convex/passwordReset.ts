import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

/**
 * Password-reset codes (SMS OTP). The plaintext code is never stored — only a
 * bcrypt hash supplied by the server. Codes expire and are single-use.
 */

export const createReset = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    codeHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.userId);
    if (!user || user.orgId !== args.orgId) throw new Error("User not found");

    // Invalidate any outstanding codes for this user.
    const existing = await ctx.db
      .query("passwordResets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const r of existing) {
      if (!r.usedAt) await ctx.db.patch(r._id, { usedAt: tsNow() });
    }

    const id = await ctx.db.insert("passwordResets", {
      orgId: args.orgId,
      userId: args.userId,
      codeHash: args.codeHash,
      expiresAt: args.expiresAt,
      attempts: 0,
      createdAt: tsNow(),
    });
    return { id };
  },
});

/** Latest unused, unexpired code for a user (for server-side verification). */
export const getActiveReset = query({
  args: { secret: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db
      .query("passwordResets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const active = rows
      .filter((r) => !r.usedAt && r.expiresAt > Date.now())
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!active) return null;
    return { id: active._id, codeHash: active.codeHash, attempts: active.attempts, expiresAt: active.expiresAt };
  },
});

export const registerFailedAttempt = mutation({
  args: { secret: v.string(), id: v.id("passwordResets") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const r = await ctx.db.get(args.id);
    if (!r) return { attempts: 0 };
    const attempts = r.attempts + 1;
    // After 5 wrong guesses, burn the code so it can't be brute-forced.
    const patch: Record<string, unknown> = { attempts };
    if (attempts >= 5) patch.usedAt = tsNow();
    await ctx.db.patch(args.id, patch);
    return { attempts };
  },
});

/** Consume a verified code and set the new password. */
export const applyReset = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    resetId: v.id("passwordResets"),
    userId: v.id("users"),
    newPasswordHash: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const r = await ctx.db.get(args.resetId);
    if (!r || r.userId !== args.userId || r.orgId !== args.orgId || r.usedAt || r.expiresAt <= Date.now()) {
      throw new Error("This reset code is no longer valid");
    }
    const user = await ctx.db.get(args.userId);
    if (!user || user.orgId !== args.orgId) throw new Error("User not found");

    await ctx.db.patch(args.userId, {
      passwordHash: args.newPasswordHash,
      mustChangePassword: false,
    });
    await ctx.db.patch(args.resetId, { usedAt: tsNow() });
    return { ok: true };
  },
});
