import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";
import { pushNotification } from "./notifications";

/** How long a visitor record is kept when the org has no explicit retention. */
const DEFAULT_RETENTION_DAYS = 365;

/**
 * Register an arriving visitor. Only admins and secretaries (reception) should
 * call this, but the check lives in the API layer; here we validate the host
 * belongs to the same organization so one tenant can never target another.
 */
export const addVisitor = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    visitorName: v.string(),
    phone: v.string(),
    carReg: v.optional(v.string()),
    visitorTo: v.id("users"),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    const host = await ctx.db.get(args.visitorTo);
    if (!host || host.orgId !== args.orgId) throw new Error("Host not found");

    const now = tsNow();
    const id = await ctx.db.insert("visitors", {
      orgId: args.orgId,
      visitorName: args.visitorName,
      phone: args.phone,
      carReg: args.carReg?.trim() || undefined,
      visitorTo: args.visitorTo,
      status: "pending",
      createdAt: now,
    });

    // Tell the person the visitor has come to see (in-app notification bell).
    await pushNotification(ctx, args.orgId, {
      userId: args.visitorTo,
      type: "visitor",
      title: `${args.visitorName} is here to see you`,
      body: `${args.phone}${args.carReg ? " · " + args.carReg : ""}`,
      link: "/visitors",
    });

    return { id, createdAt: now };
  },
});

/**
 * List visitors for an organization. Admins and secretaries (reception) see
 * everyone; other staff only see visits addressed to them. Optional `from`/`to`
 * epoch-ms bounds power date-range reports.
 */
export const listVisitors = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    const viewer = await ctx.db.get(args.viewerId);
    if (!viewer || viewer.orgId !== args.orgId) {
      throw new Error("Not a member of this organization");
    }
    const canSeeAll = viewer.role === "admin" || viewer.role === "secretary";

    let rows = await ctx.db
      .query("visitors")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    if (!canSeeAll) rows = rows.filter((r) => r.visitorTo === args.viewerId);
    if (args.from !== undefined) rows = rows.filter((r) => r.createdAt >= args.from!);
    if (args.to !== undefined) rows = rows.filter((r) => r.createdAt <= args.to!);
    rows.sort((a, b) => b.createdAt - a.createdAt);

    // Resolve host names once per unique user.
    const hostIds = Array.from(new Set(rows.map((r) => r.visitorTo as string)));
    const names = new Map<string, string>();
    for (const hid of hostIds) {
      const u = await ctx.db.get(hid as never);
      if (u && "name" in u) names.set(hid, (u as { name: string }).name);
    }

    return rows.map((r) => ({
      id: r._id,
      visitorName: r.visitorName,
      phone: r.phone,
      carReg: r.carReg ?? null,
      visitorTo: r.visitorTo,
      visitorToName: names.get(r.visitorTo as string) ?? "Unknown",
      status: r.status,
      createdAt: r.createdAt,
    }));
  },
});

/** Move a visit through pending → seen → completed. Reception (admin/secretary) only. */
export const updateVisitorStatus = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    id: v.id("visitors"),
    status: v.union(v.literal("pending"), v.literal("seen"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    const viewer = await ctx.db.get(args.viewerId);
    if (!viewer || viewer.orgId !== args.orgId) {
      throw new Error("Not a member of this organization");
    }
    if (viewer.role !== "admin" && viewer.role !== "secretary") {
      throw new Error("Only admins and secretaries can update visitor records");
    }

    const visitor = await ctx.db.get(args.id);
    if (!visitor || visitor.orgId !== args.orgId) throw new Error("Visitor not found");

    await ctx.db.patch(args.id, { status: args.status });
    return { id: args.id, status: args.status };
  },
});

/** Remove a visitor record. Admin only. */
export const deleteVisitor = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    id: v.id("visitors"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    const viewer = await ctx.db.get(args.viewerId);
    if (!viewer || viewer.orgId !== args.orgId || viewer.role !== "admin") {
      throw new Error("Only admins can delete visitor records");
    }
    const visitor = await ctx.db.get(args.id);
    if (!visitor || visitor.orgId !== args.orgId) throw new Error("Visitor not found");

    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});

export const RETENTION_DAYS = DEFAULT_RETENTION_DAYS;
