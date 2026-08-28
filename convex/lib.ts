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

export function fmtCreated(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}
