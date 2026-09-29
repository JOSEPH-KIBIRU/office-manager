import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

async function assertSuperAdmin(ctx: any, superAdminId: string) {
  const sa = await ctx.db.get(superAdminId);
  if (!sa || sa.role !== "super_admin" || !sa.active) {
    throw new Error("Platform owner access required");
  }
  return sa;
}

/** Public contact-form submission. Only needs the shared secret. */
export const createEnquiry = mutation({
  args: {
    secret: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    company: v.optional(v.string()),
    subject: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const id = await ctx.db.insert("enquiries", {
      name: args.name,
      email: args.email,
      phone: args.phone,
      company: args.company || undefined,
      subject: args.subject || undefined,
      message: args.message,
      status: "new",
      createdAt: tsNow(),
    });
    return { id };
  },
});

/** Superadmin lists all enquiries, newest first. */
export const listEnquiries = query({
  args: { secret: v.string(), superAdminId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const items = await ctx.db.query("enquiries").collect();
    return items
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((e) => ({
        id: e._id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        company: e.company ?? null,
        subject: e.subject ?? null,
        message: e.message,
        status: e.status,
        createdAt: e.createdAt,
      }));
  },
});

/** Superadmin updates an enquiry status (new / contacted / closed). */
export const updateEnquiryStatus = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    id: v.id("enquiries"),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Enquiry not found");
    await ctx.db.patch(args.id, { status: args.status });
    return { id: args.id };
  },
});

/** Superadmin deletes an enquiry. */
export const deleteEnquiry = mutation({
  args: { secret: v.string(), superAdminId: v.id("users"), id: v.id("enquiries") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Enquiry not found");
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});
