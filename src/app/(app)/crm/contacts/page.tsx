"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { PageHeader, Alert, Modal, api } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Contact {
  _id: string;
  companyId?: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  notes?: string;
}

interface Company {
  _id: string;
  name: string;
}

const EMPTY = { companyId: "", name: "", title: "", email: "", phone: "", linkedin: "", notes: "" };

export default function ContactsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, co] = await Promise.all([
        api<{ contacts: Contact[] }>(`/api/crm/contacts?q=${encodeURIComponent(q)}`),
        api<{ companies: Company[] }>("/api/crm/companies"),
      ]);
      setRows(c.contacts);
      setCompanies(co.companies);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const companyName = (id?: string) => companies.find((c) => c._id === id)?.name ?? "—";

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setOpen(true);
  }
  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      companyId: c.companyId ?? "",
      name: c.name,
      title: c.title ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      linkedin: c.linkedin ?? "",
      notes: c.notes ?? "",
    });
    setFormError(null);
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Contact name is required");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await api(`/api/crm/contacts/${editing._id}`, {
          method: "PATCH",
          json: { ...form, companyId: form.companyId || null },
        });
        toast.success("Contact saved");
      } else {
        await api("/api/crm/contacts", {
          method: "POST",
          json: { ...form, companyId: form.companyId || undefined },
        });
        toast.success("Contact added");
      }
      setOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save contact");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Contact) {
    if (!confirm(`Delete ${c.name}?`)) return;
    try {
      await api(`/api/crm/contacts/${c._id}`, { method: "DELETE" });
      toast.success("Contact deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete contact");
    }
  }

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle="People at your companies and prospects."
        action={<button className="btn-primary" onClick={openNew}>+ New contact</button>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="input w-full sm:w-72"
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-xs text-slate-500">{rows.length} contact(s)</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>Name</th><th>Company</th><th>Title</th><th>Email</th><th>Phone</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading contacts…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">No contacts yet.</td></tr>
            )}
            {!loading && rows.map((c) => (
              <tr key={c._id}>
                <td className="font-medium">{c.name}</td>
                <td>
                  {c.companyId ? (
                    <Link href={`/crm/companies/${c.companyId}`} className="text-indigo-600 hover:underline">
                      {companyName(c.companyId)}
                    </Link>
                  ) : "—"}
                </td>
                <td>{c.title || "—"}</td>
                <td>{c.email || "—"}</td>
                <td>{c.phone || "—"}</td>
                <td className="space-x-1.5 whitespace-nowrap text-right">
                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => openEdit(c)}>Edit</button>
                  <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(c)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title={editing ? "Edit contact" : "New contact"} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-3">
            {formError && <Alert kind="error">{formError}</Alert>}
            <div>
              <label className="label">Company</label>
              <select className="input" value={form.companyId} onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value }))}>
                <option value="">— none —</option>
                {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Full name</label><input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Job title</label><input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
              <div><label className="label">LinkedIn</label><input className="input" value={form.linkedin} onChange={(e) => setForm((p) => ({ ...p, linkedin: e.target.value }))} /></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add contact"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
