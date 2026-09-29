import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertSecret, requireOrg, tsNow } from "./lib";

const ONBOARDING = [
  "Signed employment contract",
  "Added to payroll",
  "Issued equipment (laptop / phone)",
  "Created email & system account",
  "Assigned to a department",
  "Enrolled in leave & attendance",
];
const OFFBOARDING = [
  "Returned equipment",
  "System access revoked",
  "Final payslip issued",
  "Handover completed",
  "Removed from payroll",
];

/** Seed the default checklist for one user (idempotent per kind). */
export async function seedDefaultsForUser(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
  kind: "onboarding" | "offboarding"
): Promise<number> {
  const existing = await ctx.db
    .query("checklistItems")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .collect();
  if (existing.some((i) => i.kind === kind)) return 0;
  const titles = kind === "onboarding" ? ONBOARDING : OFFBOARDING;
  for (let i = 0; i < titles.length; i++) {
    await ctx.db.insert("checklistItems", {
      orgId,
      userId,
      kind,
      title: titles[i],
      done: false,
      sortOrder: i,
      createdAt: tsNow(),
    });
  }
  return titles.length;
}

/** Seed default checklists for any user who doesn't have them yet (idempotent). */
export const ensureForOrg = mutation({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    let added = 0;
    for (const u of users) {
      if (u.active) added += await seedDefaultsForUser(ctx, args.orgId, u._id, "onboarding");
      else added += await seedDefaultsForUser(ctx, args.orgId, u._id, "offboarding");
    }
    return { added };
  },
});

export const list = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const items = await ctx.db
      .query("checklistItems")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const byUser = new Map<string, typeof items>();
    for (const it of items) {
      const key = it.userId as string;
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key)!.push(it);
    }

    const mapItems = (arr: typeof items) =>
      arr
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
        .map((i) => ({ id: i._id, title: i.title, done: i.done, done_at: i.doneAt ?? null }));

    return [...users]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => {
        const mine = byUser.get(u._id as string) ?? [];
        return {
          user_id: u._id,
          name: u.name,
          role: u.role,
          active: u.active,
          department_id: u.departmentId ?? null,
          onboarding: mapItems(mine.filter((i) => i.kind === "onboarding")),
          offboarding: mapItems(mine.filter((i) => i.kind === "offboarding")),
        };
      });
  },
});

export const toggleItem = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("checklistItems"), done: v.boolean(), viewerId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const item = await ctx.db.get(args.id);
    if (!item || item.orgId !== args.orgId) throw new Error("Item not found");
    await ctx.db.patch(args.id, {
      done: args.done,
      doneBy: args.done ? args.viewerId : undefined,
      doneAt: args.done ? tsNow() : undefined,
    });
    return true;
  },
});

export const addItem = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    kind: v.union(v.literal("onboarding"), v.literal("offboarding")),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    if (!args.title.trim()) throw new Error("Title is required");
    const existing = await ctx.db
      .query("checklistItems")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", args.userId))
      .collect();
    return ctx.db.insert("checklistItems", {
      orgId: args.orgId,
      userId: args.userId,
      kind: args.kind,
      title: args.title.trim(),
      done: false,
      sortOrder: existing.length + 1,
      createdAt: tsNow(),
    });
  },
});

export const deleteItem = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("checklistItems") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const item = await ctx.db.get(args.id);
    if (!item || item.orgId !== args.orgId) throw new Error("Item not found");
    await ctx.db.delete(args.id);
    return true;
  },
});
