import { Id } from "./_generated/dataModel";

/**
 * Load a related record and assert it belongs to the tenant. Used for every
 * cross-record reference (company, contact, deal, owner, quotation, …) so a
 * caller can never link across organisations.
 */
export async function requireTenantRef(
  ctx: any,
  orgId: Id<"organizations">,
  id: string,
  label: string
): Promise<any> {
  const doc = await ctx.db.get(id);
  if (!doc || doc.orgId !== orgId) throw new Error(`${label} not found`);
  return doc;
}

/** Same as requireTenantRef but allows an absent/optional reference. */
export async function requireOptionalRef(
  ctx: any,
  orgId: Id<"organizations">,
  id: string | undefined | null,
  label: string
): Promise<any | null> {
  if (id === undefined || id === null) return null;
  return requireTenantRef(ctx, orgId, id, label);
}

const ENTITY_TABLES: Record<string, string> = {
  company: "crmCompanies",
  contact: "crmContacts",
  lead: "crmLeads",
  deal: "crmDeals",
  quotation: "crmQuotations",
};

/** Validate a polymorphic activity target (entityType + entityId) in the tenant. */
export async function requireActivityEntity(
  ctx: any,
  orgId: Id<"organizations">,
  entityType: string,
  entityId: string
): Promise<void> {
  const table = ENTITY_TABLES[entityType];
  if (!table) throw new Error("Unknown activity entity type");
  const doc = await ctx.db.get(entityId);
  if (!doc || doc.orgId !== orgId) throw new Error("Related record not found");
}
