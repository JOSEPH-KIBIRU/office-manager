"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, Alert, Modal, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePermissions } from "@/components/usePermissions";

interface Company {
  _id: string;
  name: string;
  domain?: string;
  industry?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  source?: string;
  notes?: string;
  accountingContactId?: string;
}

interface Contact {
  _id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  notes?: string;
}

const EDITABLE = ["name", "domain", "industry", "website", "phone", "address", "city", "country", "source", "notes"] as const;
type Editable = (typeof EDITABLE)[number];

const EMPTY_CONTACT = { name: "", title: "", email: "", phone: "", linkedin: "", notes: "" };

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const { modules, can } = usePermissions();

  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<Record<Editable, string>>({
    name: "", domain: "", industry: "", website: "", phone: "", address: "", city: "", country: "", source: "", notes: "",
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactBusy, setContactBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, ct] = await Promise.all([
        api<{ company: Company | null }>(`/api/crm/companies/${id}`),
        api<{ contacts: Contact[] }>(`/api/crm/contacts?companyId=${encodeURIComponent(id)}`),
      ]);
      setCompany(c.company);
      setContacts(ct.contacts);
      if (c.company) {
        setForm({
          name: c.company.name ?? "",
          domain: c.company.domain ?? "",
          industry: c.company.industry ?? "",
          website: c.company.website ?? "",
          phone: c.company.phone ?? "",
          address: c.company.address ?? "",
          city: c.company.city ?? "",
          country: c.company.country ?? "",
          source: c.company.source ?? "",
          notes: c.company.notes ?? "",
        });
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key: Editable) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value })),
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Company name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(`/api/crm/companies/${id}`, { method: "PATCH", json: form });
      toast.success("Company saved");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save company");
    } finally {
      setSaving(false);
    }
  }

  async function promote() {
    setPromoting(true);
    setError(null);
    try {
      const res = await api<{ contactId: string; created: boolean }>(`/api/crm/companies/${id}/promote`, {
        method: "POST",
      });
      toast.success(res.created ? "Accounting customer created and linked." : "Company already linked to a customer.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to promote company");
    } finally {
      setPromoting(false);
    }
  }

  async function addContact(e: FormEvent) {
    e.preventDefault();
    if (!contactForm.name.trim()) {
      setContactError("Contact name is required");
      return;
    }
    setContactBusy(true);
    setContactError(null);
    try {
      await api("/api/crm/contacts", { method: "POST", json: { ...contactForm, companyId: id } });
      toast.success("Contact added");
      setShowContact(false);
      setContactForm(EMPTY_CONTACT);
      await load();
    } catch (e) {
      setContactError(e instanceof Error ? e.message : "Failed to add contact");
    } finally {
      setContactBusy(false);
    }
  }

  async function removeContact(contactId: string) {
    try {
      await api(`/api/crm/contacts/${contactId}`, { method: "DELETE" });
      toast.success("Contact removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove contact");
    }
  }

  if (Array.isArray(modules) && !can("crm-companies")) {
    return (
      <>
        <PageHeader title="Company" />
        <Alert kind="error">You do not have access to CRM companies.</Alert>
      </>
    );
  }

  return (
    <>
      <div className="mb-2">
        <Link href="/crm/companies" className="text-sm text-slate-500 hover:text-slate-700">← Companies</Link>
      </div>
      <PageHeader
        title={company?.name ?? "Company"}
        subtitle="Account details, contacts and accounting link."
        action={
          <div className="flex gap-2">
            <button className="btn-primary" onClick={save} disabled={saving || loading}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        }
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {loading && <p className="text-sm text-slate-500">Loading company…</p>}

      {!loading && !company && <Alert kind="error">Company not found.</Alert>}

      {company && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <form onSubmit={save} className="card space-y-3 p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-600">Details</h2>
            <div>
              <label className="label">Company name</label>
              <input className="input" {...setField("name")} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Domain</label><input className="input" {...setField("domain")} /></div>
              <div><label className="label">Industry</label><input className="input" {...setField("industry")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Phone</label><input className="input" {...setField("phone")} /></div>
              <div><label className="label">Website</label><input className="input" {...setField("website")} /></div>
            </div>
            <div><label className="label">Address</label><input className="input" {...setField("address")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">City</label><input className="input" {...setField("city")} /></div>
              <div><label className="label">Country</label><input className="input" {...setField("country")} /></div>
            </div>
            <div><label className="label">Source</label><input className="input" {...setField("source")} /></div>
            <div><label className="label">Notes</label><textarea className="input" rows={3} {...setField("notes")} /></div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </form>

          <div className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold text-slate-600">Accounting</h2>
            {company.accountingContactId ? (
              <p className="text-sm text-slate-600">
                Linked to an accounting customer. Invoices and payments stay authoritative in Accounting.
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Not linked to an accounting customer yet. Promoting creates a customer record in Accounting.
              </p>
            )}
            {can("invoices") ? (
              <button className="btn-secondary w-full" onClick={promote} disabled={promoting}>
                {promoting ? "Working…" : company.accountingContactId ? "Re-check link" : "Create accounting customer"}
              </button>
            ) : (
              <p className="text-xs text-slate-400">Accounting (invoicing) is not enabled for your role.</p>
            )}
          </div>

          <div className="card p-5 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-600">Contacts</h2>
              <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setShowContact(true)}>+ Add contact</button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="table-base">
                <thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Phone</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {contacts.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-500">No contacts yet.</td></tr>}
                  {contacts.map((c) => (
                    <tr key={c._id}>
                      <td className="font-medium">{c.name}</td>
                      <td>{c.title || "—"}</td>
                      <td>{c.email || "—"}</td>
                      <td>{c.phone || "—"}</td>
                      <td className="text-right">
                        <button className="btn-danger px-2 py-1 text-xs" onClick={() => removeContact(c._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showContact && (
        <Modal title="Add contact" onClose={() => setShowContact(false)}>
          <form onSubmit={addContact} className="space-y-3">
            {contactError && <Alert kind="error">{contactError}</Alert>}
            <div><label className="label">Full name</label><input className="input" value={contactForm.name} onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))} required autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Job title</label><input className="input" value={contactForm.title} onChange={(e) => setContactForm((p) => ({ ...p, title: e.target.value }))} /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={contactForm.email} onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Phone</label><input className="input" value={contactForm.phone} onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))} /></div>
              <div><label className="label">LinkedIn</label><input className="input" value={contactForm.linkedin} onChange={(e) => setContactForm((p) => ({ ...p, linkedin: e.target.value }))} /></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={contactForm.notes} onChange={(e) => setContactForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setShowContact(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={contactBusy}>{contactBusy ? "Saving…" : "Add contact"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
