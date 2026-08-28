import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { assertSecret, tsNow, tsString, fmtCreated } from "./lib";

type ReqDoc = Doc<"profileRequests">;

async function enrich(ctx: QueryCtx, r: ReqDoc) {
  const requester = await ctx.db.get(r.userId);
  return {
    id: r._id,
    user_id: r.userId,
    requester_name: requester?.name ?? "Unknown",
    field: r.field,
    current_value: r.currentValue ?? null,
    requested_value: r.requestedValue,
    status: r.status,
    reviewed_by: r.reviewedBy ?? null,
    reviewed_at: r.reviewedAt ?? null,
    created_at: fmtCreated(r.createdAt),
  };
}

export const listProfileRequests = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db
      .query("profileRequests")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    let docs = args.userId ? all.filter((r) => r.userId === args.userId) : all;
    if (args.userId) {
      docs = [...docs].sort((a, b) => b.createdAt - a.createdAt);
    } else {
      const rank = (r: ReqDoc) => (r.status === "pending" ? 0 : 1);
      docs = [...docs].sort((a, b) => rank(a) - rank(b) || b.createdAt - a.createdAt);
    }
    return Promise.all(docs.map((d) => enrich(ctx, d)));
  },
});

export const getProfileRequest = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("profileRequests") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return enrich(ctx, doc);
  },
});

export const createProfileRequest = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    field: v.union(v.literal("name"), v.literal("email")),
    currentValue: v.string(),
    requestedValue: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return ctx.db.insert("profileRequests", {
      orgId: args.orgId,
      userId: args.userId,
      field: args.field,
      currentValue: args.currentValue,
      requestedValue: args.requestedValue,
      status: "pending",
      createdAt: tsNow(),
    });
  },
});

export const hasPendingRequest = query({
  args: { secret: v.string(), userId: v.id("users"), field: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db
      .query("profileRequests")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("field"), args.field),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();
    return Boolean(rows);
  },
});

export const reviewProfileRequest = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("profileRequests"),
    action: v.union(v.literal("approve"), v.literal("reject")),
    reviewerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== args.orgId) throw new Error("Request not found");
    if (row.status !== "pending") throw new Error(`This request was already ${row.status}`);

    if (args.action === "approve") {
      if (row.field === "name") {
        await ctx.db.patch(row.userId, { name: row.requestedValue });
      } else {
        // Email is the global login key — uniqueness is platform-wide.
        const all = await ctx.db.query("users").collect();
        const conflict = all.find(
          (u) => u._id !== row.userId && u.email === row.requestedValue.toLowerCase()
        );
        if (conflict) throw new Error("That email is now in use by another account");
        await ctx.db.patch(row.userId, {
          email: row.requestedValue.toLowerCase(),
          mustChangePassword: false,
        });
      }
      await ctx.db.patch(row._id, {
        status: "approved",
        reviewedBy: args.reviewerId,
        reviewedAt: tsString(),
      });
    } else {
      await ctx.db.patch(row._id, {
        status: "rejected",
        reviewedBy: args.reviewerId,
        reviewedAt: tsString(),
      });
    }
    return true;
  },
});
