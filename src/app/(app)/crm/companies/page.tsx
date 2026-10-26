"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { PageHeader, Alert, Modal, api } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Company {
  _id: string;
  name: string;
  domain?: string;
  industry?: string;
  phone?: string;
  accountingContactId?: string;
}

const EMPTY = {
  name: "",
  domain: "",
  industry: "",
  website: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  source: "",
  notes: "",
};

export default function CompaniesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Company[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ companies: Company[] }>(`/api/crm/companies?q=${encodeURIComponent(q)}`);
      setRows(data.companies);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Company name is required");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api("/api/crm/companies", { method: "POST", json: form });
      toast.success("Company added");
      setShowNew(false);
      setForm(EMPTY);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create company");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof EMPTY) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value })),
  });

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle="Accounts your team is working with."
        action={<button className="btn-primary" onClick={() => setShowNew(true)}>+ New company</button>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="input w-full sm:w-72"
          placeholder="Search by name or domain…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-xs text-slate-500">{rows.length} company(s)</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Industry</th>
              <th>Phone</th>
              <th>Accounting</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading companies…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">No companies yet. Add your first account.</td></tr>
            )}
            {!loading && rows.map((c) => (
              <tr key={c._id}>
                <td className="font-medium">
                  <Link href={`/crm/companies/${c._id}`} className="text-indigo-600 hover:underline">{c.name}</Link>
                </td>
                <td>{c.domain || "—"}</td>
                <td>{c.industry || "—"}</td>
                <td>{c.phone || "—"}</td>
                <td>
                  {c.accountingContactId ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Customer linked</span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="text-right">
                  <Link href={`/crm/companies/${c._id}`} className="btn-secondary btn-xs">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <Modal title="New company" onClose={() => setShowNew(false)}>
          <form onSubmit={create} className="space-y-3">
            {formError && <Alert kind="error">{formError}</Alert>}
            <div>
              <label className="label">Company name</label>
              <input className="input" {...field("name")} required autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Domain</label><input className="input" placeholder="acme.co.ke" {...field("domain")} /></div>
              <div><label className="label">Industry</label><input className="input" {...field("industry")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Phone</label><input className="input" {...field("phone")} /></div>
              <div><label className="label">Website</label><input className="input" {...field("website")} /></div>
            </div>
            <div><label className="label">Address</label><input className="input" {...field("address")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">City</label><input className="input" {...field("city")} /></div>
              <div><label className="label">Country</label><input className="input" {...field("country")} /></div>
            </div>
            <div><label className="label">Source</label><input className="input" placeholder="referral, website…" {...field("source")} /></div>
            <div><label className="label">Notes</label><textarea className="input" rows={3} {...field("notes")} /></div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Create company"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
