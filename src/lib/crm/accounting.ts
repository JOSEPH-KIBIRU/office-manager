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

export interface ConvertedQuotation {
  invoiceId: string;
  created: boolean;
}

/**
 * Convert an accepted CRM quotation into an accounting invoice (created as a
 * draft so it can be reviewed in Accounting before issuing). The quotation is
 * marked converted and keeps the invoice reference. Idempotent.
 */
export async function createInvoiceFromQuotation(
  session: SessionPayload,
  quotationId: string
): Promise<ConvertedQuotation> {
  const raw = await cx().query(api.crmQuotations.getQuotation, {
    secret: secret(),
    orgId: session.orgId as never,
    id: quotationId as never,
  });
  if (!raw) throw new HttpError(404, "Quotation not found");

  const q = raw as unknown as {
    status: string;
    invoiceId?: string;
    companyId?: string;
    notes?: string;
    terms?: string;
    items: Array<{ description: string; qty: number; unitPrice: number; taxRate: number }>;
  };

  if (q.invoiceId) return { invoiceId: q.invoiceId, created: false };
  if (q.status !== "accepted") {
    throw new HttpError(400, "Accept the quotation before converting it to an invoice");
  }
  if (!q.companyId) throw new HttpError(400, "Link the quotation to a company before converting");
  const items = (q.items ?? []).map((it) => ({
    description: it.description,
    qty: it.qty,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
  }));
  if (items.length === 0) throw new HttpError(400, "The quotation has no line items");

  const promoted = await ensureCustomerForCompany(session, q.companyId);

  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const invoiceId = await cx().mutation(api.invoicing.createInvoice, {
    secret: secret(),
    orgId: session.orgId as never,
    contactId: promoted.contactId as never,
    issueDate: today,
    dueDate: due,
    lineItems: items,
    note: q.notes,
    terms: q.terms,
    createdBy: session.id as never,
  });

  await cx().mutation(api.crmQuotations.markConverted, {
    secret: secret(),
    orgId: session.orgId as never,
    actorId: session.id as never,
    id: quotationId as never,
    invoiceId: invoiceId as never,
  });

  return { invoiceId: String(invoiceId), created: true };
}
