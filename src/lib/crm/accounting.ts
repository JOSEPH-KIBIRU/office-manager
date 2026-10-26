import "server-only";
import { HttpError } from "@/lib/auth";
import { cx, secret, api } from "@/lib/convex";
import type { SessionPayload } from "@/lib/types";

export interface PromotedCustomer {
  contactId: string;
  created: boolean;
}

interface CompanyLike {
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  notes?: string;
  accountingContactId?: string;
}

/**
 * Create or reuse the authoritative accounting customer for a CRM company.
 *
 * Idempotent: if the company is already linked and the contact still exists it
 * is returned unchanged. The CRM never writes invoices or journals itself —
 * this is the only CRM -> accounting write, and it goes through the existing
 * `invoicing` functions.
 */
export async function ensureCustomerForCompany(
  session: SessionPayload,
  companyId: string
): Promise<PromotedCustomer> {
  const raw = await cx().query(api.crmCompanies.getCompany, {
    secret: secret(),
    orgId: session.orgId as never,
    id: companyId as never,
  });
  if (!raw) throw new HttpError(404, "Company not found");
  const company = raw as unknown as CompanyLike;

  if (company.accountingContactId) {
    const existing = await cx().query(api.invoicing.getContact, {
      secret: secret(),
      orgId: session.orgId as never,
      id: company.accountingContactId as never,
    });
    if (existing) return { contactId: company.accountingContactId, created: false };
  }

  const address = [company.address, company.city, company.country]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(", ");

  const contactId = await cx().mutation(api.invoicing.createContact, {
    secret: secret(),
    orgId: session.orgId as never,
    type: "customer",
    name: company.name,
    legalName: company.name,
    company: company.name,
    phone: company.phone,
    address: address || undefined,
    notes: company.notes,
    createdBy: session.id as never,
  });

  await cx().mutation(api.crmCompanies.updateCompany, {
    secret: secret(),
    orgId: session.orgId as never,
    actorId: session.id as never,
    id: companyId as never,
    accountingContactId: contactId as never,
  });

  return { contactId: String(contactId), created: true };
}
