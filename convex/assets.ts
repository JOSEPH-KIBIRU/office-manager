import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, requireMember, tsNow } from "./lib";
import { pushNotification } from "./notifications";

type AssetStatus = "available" | "assigned" | "maintenance" | "retired";

function fmtTime(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

/** The asset register, with the person currently holding each item. */
export const listAssets = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("assets").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return [...rows]
      .sort((a, b) => a.name.localeCompare(b.name) || a.tag.localeCompare(b.tag))
      .map((a) => ({
        id: a._id,
        tag: a.tag,
        name: a.name,
        category: a.category ?? null,
        serialNumber: a.serialNumber ?? null,
        condition: a.condition ?? null,
        status: a.status,
        holderId: a.currentHolderId ?? null,
        holderName: a.currentHolderName ?? null,
        checkedOutAt: a.currentCheckedOutAt ?? null,
        checkedOutAtText: a.currentCheckedOutAt ? fmtTime(a.currentCheckedOutAt) : null,
        active: a.active,
        created_at: fmtTime(a.createdAt),
      }));
  },
});

/** Assets currently in a given user's custody. */
export const listMyAssets = query({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    const rows = await ctx.db.query("assets").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return rows
      .filter((a) => a.currentHolderId === args.userId)
      .map((a) => ({
        id: a._id,
        tag: a.tag,
        name: a.name,
        category: a.category ?? null,
        condition: a.condition ?? null,
        checkedOutAtText: a.currentCheckedOutAt ? fmtTime(a.currentCheckedOutAt) : null,
      }));
  },
});

export const createAsset = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    tag: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    condition: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const tag = args.tag.trim();
    const name = args.name.trim();
    if (!name) throw new Error("Asset name is required");
    if (!tag) throw new Error("Asset tag/number is required");
    const dupe = await ctx.db
      .query("assets")
      .withIndex("by_org_tag", (q) => q.eq("orgId", args.orgId).eq("tag", tag))
      .first();
    if (dupe) throw new Error(`An asset with tag "${tag}" already exists`);
    return ctx.db.insert("assets", {
      orgId: args.orgId,
      tag,
      name,
      category: args.category?.trim() || undefined,
      serialNumber: args.serialNumber?.trim() || undefined,
      condition: args.condition?.trim() || undefined,
      status: "available",
      active: true,
      createdAt: tsNow(),
    });
  },
});

export const updateAsset = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("assets"),
    tag: v.optional(v.string()),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    condition: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("available"), v.literal("assigned"), v.literal("maintenance"), v.literal("retired"))
    ),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const asset = await ctx.db.get(args.id);
    if (!asset || asset.orgId !== args.orgId) throw new Error("Asset not found");
    const patch: Record<string, unknown> = {};
    if (args.tag !== undefined) patch.tag = args.tag.trim();
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.category !== undefined) patch.category = args.category.trim() || undefined;
    if (args.serialNumber !== undefined) patch.serialNumber = args.serialNumber.trim() || undefined;
    if (args.condition !== undefined) patch.condition = args.condition.trim() || undefined;
    if (args.status !== undefined) {
      if (asset.status === "assigned" && args.status !== "assigned") {
        throw new Error("Return the asset before changing its status");
      }
      patch.status = args.status;
    }
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(args.id, patch);
    return { id: args.id };
  },
});

export const deleteAsset = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("assets") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const asset = await ctx.db.get(args.id);
    if (!asset || asset.orgId !== args.orgId) throw new Error("Asset not found");
    if (asset.status === "assigned") throw new Error("This asset is checked out — return it before deleting");
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});

/** Allocate (check out) an asset to a staff member for field work. */
export const allocateAsset = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    assetId: v.id("assets"),
    holderId: v.id("users"),
    recordedBy: v.optional(v.id("users")),
    recordedByName: v.optional(v.string()),
    at: v.optional(v.number()),
    destination: v.optional(v.string()),
    condition: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.orgId !== args.orgId) throw new Error("Asset not found");
    if (!asset.active) throw new Error("This asset is inactive");
    if (asset.status === "assigned") throw new Error("This asset is already allocated to someone");
    if (asset.status === "retired") throw new Error("This asset has been retired");

    const holder = await ctx.db.get(args.holderId);
    if (!holder || holder.orgId !== args.orgId) throw new Error("Employee not found");

    const at = args.at ?? tsNow();
    await ctx.db.patch(args.assetId, {
      status: "assigned",
      currentHolderId: holder._id,
      currentHolderName: holder.name,
      currentCheckedOutAt: at,
      condition: args.condition?.trim() || asset.condition,
    });

    const id = await ctx.db.insert("assetMovements", {
      orgId: args.orgId,
      assetId: asset._id,
      assetName: asset.name,
      assetTag: asset.tag,
      action: "checkout",
      holderId: holder._id,
      holderName: holder.name,
      recordedBy: args.recordedBy,
      recordedByName: args.recordedByName?.trim() || undefined,
      at,
      destination: args.destination?.trim() || undefined,
      condition: args.condition?.trim() || undefined,
      note: args.note?.trim() || undefined,
      createdAt: tsNow(),
    });

    await pushNotification(ctx, args.orgId as unknown as string, {
      userId: holder._id as unknown as string,
      type: "asset",
      title: `Asset allocated: ${asset.name}`,
      body: `Tag ${asset.tag}${args.destination ? " · for " + args.destination : ""}. Return it to close the trail.`,
      link: "/dashboard",
    });

    return { id };
  },
});

/** Return (check in) an allocated asset, closing the custody trail. */
export const returnAsset = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    assetId: v.id("assets"),
    recordedBy: v.optional(v.id("users")),
    recordedByName: v.optional(v.string()),
    at: v.optional(v.number()),
    condition: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.orgId !== args.orgId) throw new Error("Asset not found");
    if (asset.status !== "assigned" || !asset.currentHolderId) {
      throw new Error("This asset is not currently allocated");
    }

    const holderId = asset.currentHolderId;
    const holderName = asset.currentHolderName ?? "Unknown";
    const at = args.at ?? tsNow();

    await ctx.db.patch(args.assetId, {
      status: "available",
      currentHolderId: undefined,
      currentHolderName: undefined,
      currentCheckedOutAt: undefined,
      condition: args.condition?.trim() || asset.condition,
    });

    const id = await ctx.db.insert("assetMovements", {
      orgId: args.orgId,
      assetId: asset._id,
      assetName: asset.name,
      assetTag: asset.tag,
      action: "checkin",
      holderId,
      holderName,
      recordedBy: args.recordedBy,
      recordedByName: args.recordedByName?.trim() || undefined,
      at,
      condition: args.condition?.trim() || undefined,
      note: args.note?.trim() || undefined,
      createdAt: tsNow(),
    });

    return { id };
  },
});

/** The movement trail (checkout/checkin) with optional filters, newest first. */
export const listAssetMovements = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    assetId: v.optional(v.id("assets")),
    holderId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    let rows = await ctx.db
      .query("assetMovements")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (args.assetId) rows = rows.filter((r) => r.assetId === args.assetId);
    if (args.holderId) rows = rows.filter((r) => r.holderId === args.holderId);
    if (args.from !== undefined) rows = rows.filter((r) => r.at >= args.from!);
    if (args.to !== undefined) rows = rows.filter((r) => r.at <= args.to!);
    rows.sort((a, b) => b.at - a.at);
    return rows.map((r) => ({
      id: r._id,
      assetId: r.assetId,
      assetName: r.assetName,
      assetTag: r.assetTag,
      action: r.action,
      holderId: r.holderId,
      holderName: r.holderName,
      recordedByName: r.recordedByName ?? null,
      at: r.at,
      atText: fmtTime(r.at),
      date: new Date(r.at).toISOString().slice(0, 10),
      destination: r.destination ?? null,
      condition: r.condition ?? null,
      note: r.note ?? null,
    }));
  },
});
