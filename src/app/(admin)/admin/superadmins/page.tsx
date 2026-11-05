"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { PageHeader, Alert, Modal, api } from "@/components/ui";
import { useToast } from "@/components/toast";

interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_owner: boolean;
  active: boolean;
  created_at: string;
}

interface Me {
  id: string;
  isOwner: boolean;
}

export default function PlatformTeamPage() {
  const toast = useToast();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<PlatformAdmin | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    tempPassword: string;
    smsSent: boolean;
    emailSent: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ me: Me; admins: PlatformAdmin[] }>("/api/admin/superadmins");
      setMe(data.me);
      setAdmins(data.admins);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load superadmins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Name, email and phone are required");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{
        email: string;
        tempPassword: string;
        delivery?: { emailSent: boolean; smsSent: boolean };
      }>("/api/admin/superadmins", { method: "POST", json: form });
      setCreated({
        email: res.email,
        tempPassword: res.tempPassword,
        smsSent: !!res.delivery?.smsSent,
        emailSent: !!res.delivery?.emailSent,
      });
      setForm({ name: "", email: "", phone: "" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add superadmin");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const target = deleting;
    if (!target) return;
    setBusy(true);
    try {
      await api(`/api/admin/superadmins/${target.id}`, { method: "DELETE" });
      toast.success(`${target.name} removed.`);
      setDeleting(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove superadmin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Platform team"
        subtitle="Superadmins who can operate the platform console. Only the platform owner can add or remove them."
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {loading && <p className="text-sm text-slate-500">Loading superadmins…</p>}

      {!loading && me && !me.isOwner && (
        <div className="mb-4"><Alert kind="success">You can view the platform team. Only the platform owner can add or remove superadmins.</Alert></div>
      )}

      {me?.isOwner && (
        <div className="card mb-6 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a superadmin</h2>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Phone (SMS login)</label>
              <input className="input" type="tel" placeholder="+2547…" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? "Adding…" : "+ Add superadmin"}
              </button>
            </div>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            Login details are sent to this phone by SMS (and email when configured). Delegated superadmins can
            create companies and use the console, but cannot delete companies or manage the platform team.
          </p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Created</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {!loading && admins.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">No superadmins found.</td></tr>
            )}
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.name}{me?.id === a.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}</td>
                <td>{a.email}</td>
                <td>{a.phone ?? "—"}</td>
                <td>
                  {a.is_owner ? (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">Platform owner</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Superadmin</span>
                  )}
                </td>
                <td className="text-slate-500">{a.created_at}</td>
                <td className="text-right">
                  {me?.isOwner && !a.is_owner && a.id !== me.id && (
                    <button className="btn-danger px-2 py-1 text-xs" onClick={() => setDeleting(a)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleting && (
        <Modal title="Remove superadmin" onClose={() => setDeleting(null)}>
          <p className="text-sm text-slate-600">
            Remove <strong>{deleting.name}</strong> ({deleting.email}) from the platform team? They will lose
            access to the platform console immediately.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDeleting(null)} disabled={busy}>Cancel</button>
            <button className="btn-danger" onClick={remove} disabled={busy}>{busy ? "Removing…" : "Remove"}</button>
          </div>
        </Modal>
      )}

      {created && (
        <Modal title="Superadmin added" onClose={() => setCreated(null)}>
          <p className="text-sm text-slate-600">
            Login details for <strong>{created.email}</strong>:
            {created.smsSent || created.emailSent
              ? ` ${created.smsSent ? "sent by SMS" : ""}${created.smsSent && created.emailSent ? " and" : ""}${created.emailSent ? " email" : ""}.`
              : " automatic delivery is not configured — share this temporary password manually."}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm tracking-wide">{created.tempPassword}</code>
            <button className="btn-secondary" onClick={() => { navigator.clipboard?.writeText(created.tempPassword); toast.success("Copied"); }}>Copy</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">They must change it at first login. Shown only once.</p>
          <div className="mt-4 flex justify-end">
            <button className="btn-primary" onClick={() => setCreated(null)}>Done</button>
          </div>
        </Modal>
      )}
    </>
  );
}
