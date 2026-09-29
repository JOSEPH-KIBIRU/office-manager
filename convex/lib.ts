import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export function assertSecret(secret: unknown) {
  if (!secret || secret !== process.env.CONVEX_SERVER_SECRET) {
    throw new Error("Unauthorized server call");
  }
}

export function tsNow(): number {
  return Date.now();
}

export function tsString(ms?: number | null): string {
  return new Date(ms ?? Date.now())
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

export type OrgCtx = QueryCtx | MutationCtx;

/** Every domain call passes orgId; this guarantees it exists and is active. */
export async function requireOrg(ctx: OrgCtx, orgId: Id<"organizations">): Promise<Doc<"organizations">> {
  const org = await ctx.db.get(orgId);
  if (!org || !org.active) throw new Error("Organization not found or inactive");
  return org;
}

/**
 * Load a user and verify they are an active member of `orgId`.
 * This is the data-layer proof that a requested user belongs to the tenant —
 * callers (the Next.js session layer) must still bind "who is acting" to the
 * signed session id, but Convex now fails closed on cross-org/missing users.
 */
export async function requireMember(
  ctx: OrgCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">
): Promise<Doc<"users">> {
  const u = await ctx.db.get(userId);
  if (!u || u.orgId !== orgId) throw new Error("Not authorized");
  if (!u.active) throw new Error("Account is disabled");
  return u;
}

export function isOrgAdmin(user: { role: string }): boolean {
  return user.role === "admin";
}

export function fmtCreated(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Resolve the branding fields (incl. a live storage logo URL) for an organization
 * so printable pages (payslip / invoice / P9 / reports) can render company details.
 */
export async function orgBranding(ctx: OrgCtx, orgId: Id<"organizations">) {
  const org = await ctx.db.get(orgId);
  if (!org || !org.active) return null;
  let logoUrl: string | null = null;
  if (org.logoFileId) {
    logoUrl = (await ctx.storage.getUrl(org.logoFileId)) ?? null;
  }
  return {
    id: org._id,
    name: org.name,
    logoUrl,
    address: org.address ?? null,
    city: org.city ?? null,
    phone: org.phone ?? null,
    email: org.email ?? null,
    taxNumber: org.taxNumber ?? null,
    website: org.website ?? null,
    paymentDetails: org.paymentDetails ?? null,
    invoiceNotes: org.invoiceNotes ?? null,
    invoiceTerms: org.invoiceTerms ?? null,
  };
}
