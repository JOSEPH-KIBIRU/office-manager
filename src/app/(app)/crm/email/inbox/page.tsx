"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Alert, Modal, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePermissions } from "@/components/usePermissions";

interface Message {
  id: string;
  provider: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  subject: string | null;
  snippet: string | null;
  receivedAt: number;
  hasAttachments: boolean;
  ignored: boolean;
  contactId: string | null;
  contactName: string | null;
  companyId: string | null;
  companyName: string | null;
  leadId: string | null;
  leadName: string | null;
  dealId: string | null;
}
interface Contact { _id: string; name: string; companyId?: string; }
interface Company { _id: string; name: string; }

const FILTERS = [
  { id: "unlinked", label: "Needs attention" },
  { id: "linked", label: "Linked" },
  { id: "ignored", label: "Ignored" },
  { id: "all", label: "All" },
] as const;

function fmt(ms: number) {
  return new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function InboxPage() {
  const toast = useToast();
  const { modules, can } = usePermissions();
  const [filter, setFilter] = useState<string>("unlinked");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [linkFor, setLinkFor] = useState<Message | null>(null);
  const [linkContact, setLinkContact] = useState("");
  const [linkCompany, setLinkCompany] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, ct, co] = await Promise.all([
        api<{ messages: Message[] }>(`/api/crm/email/messages?filter=${filter}`),
        api<{ contacts: Contact[] }>("/api/crm/contacts").catch(() => ({ contacts: [] as Contact[] })),
        api<{ companies: Company[] }>("/api/crm/companies").catch(() => ({ companies: [] as Company[] })),
      ]);
      setRows(data.messages);
      setContacts(ct.contacts);
      setCompanies(co.companies);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = rows.filter((m) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [m.from, m.subject ?? "", m.snippet ?? ""].some((s) => s.toLowerCase().includes(needle));
  });

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await api<{ synced: number }>("/api/crm/email/sync", { method: "POST" });
      toast.success(`Synced ${res.synced} mailbox(es)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function createLead(m: Message) {
    setBusy(m.id);
    try {
      const res = await api<{ leadId: string; created: boolean }>(`/api/crm/email/messages/${m.id}/lead`, { method: "POST" });
      toast.success(res.created ? "Lead created from email" : "Linked to an existing lead");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create lead");
    } finally {
      setBusy(null);
    }
  }

  async function toggleIgnore(m: Message) {
    setBusy(m.id);
    try {
      await api(`/api/crm/email/messages/${m.id}`, { method: "PATCH", json: { ignored: !m.ignored } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update email");
    } finally {
      setBusy(null);
    }
  }

  function openLink(m: Message) {
    setLinkFor(m);
    setLinkContact(m.contactId ?? "");
    setLinkCompany(m.companyId ?? "");
  }

  async function saveLink() {
    if (!linkFor) return;
    setLinkBusy(true);
    try {
      await api(`/api/crm/email/messages/${linkFor.id}`, {
        method: "PATCH",
        json: {
          contactId: linkContact || null,
          companyId: linkCompany || null,
        },
      });
      toast.success("Email linked");
      setLinkFor(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to link email");
    } finally {
      setLinkBusy(false);
    }
  }

  if (Array.isArray(modules) && !can("crm-email")) {
    return (
      <>
        <PageHeader title="Email inbox" />
        <Alert kind="error">You do not have access to the CRM email inbox.</Alert>
      </>
    );
  }

  return (
    <>
      <div className="mb-2">
        <Link href="/crm/email" className="text-sm text-slate-500 hover:text-slate-700">← Email settings</Link>
      </div>
      <PageHeader
        title="Email inbox"
        subtitle="Synced emails. Turn a sender into a lead, link it to a company/contact, or ignore it."
        action={
          <button className="btn-secondary" onClick={syncNow} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        }
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                filter === f.id
                  ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
                  : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <input className="input ml-auto w-full sm:w-64" placeholder="Search sender or subject…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-xs text-slate-500">{visible.length} email(s)</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>From</th><th>Subject</th><th>Received</th><th>Linked</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Loading inbox…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-slate-500">
                {filter === "unlinked" ? "Nothing needs attention. Emails already linked to CRM records appear under Linked." : "No emails here."}
              </td></tr>
            )}
            {!loading && visible.map((m) => (
              <tr key={m.id} className={m.ignored ? "opacity-60" : ""}>
                <td className="max-w-[16rem] truncate">
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${m.direction === "inbound" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                    {m.direction}
                  </span>
                  <span className="text-sm text-slate-700">{m.from}</span>
                </td>
                <td className="max-w-[22rem]">
                  <p className="truncate text-sm font-medium text-slate-800">{m.subject || "(no subject)"}</p>
                  {m.snippet && <p className="truncate text-xs text-slate-400">{m.snippet}</p>}
                </td>
                <td className="whitespace-nowrap text-xs text-slate-500">{fmt(m.receivedAt)}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {m.leadName && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">Lead: {m.leadName}</span>}
                    {m.contactName && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{m.contactName}</span>}
                    {m.companyId && m.companyName && (
                      <Link href={`/crm/companies/${m.companyId}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:underline">
                        {m.companyName}
                      </Link>
                    )}
                    {!m.leadName && !m.contactName && !m.companyId && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
                <td className="space-x-1.5 whitespace-nowrap text-right">
                  {m.direction === "inbound" && !m.leadId && (
                    <button className="btn-success px-2 py-1 text-xs" onClick={() => createLead(m)} disabled={busy === m.id}>
                      Create lead
                    </button>
                  )}
                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => openLink(m)}>Link</button>
                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => toggleIgnore(m)} disabled={busy === m.id}>
                    {m.ignored ? "Restore" : "Ignore"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {linkFor && (
        <Modal title="Link email" onClose={() => setLinkFor(null)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Link this email from <strong>{linkFor.from}</strong> to an existing CRM record.
            </p>
            <div>
              <label className="label">Contact</label>
              <select
                className="input"
                value={linkContact}
                onChange={(e) => {
                  const cid = e.target.value;
                  setLinkContact(cid);
                  const c = contacts.find((x) => x._id === cid);
                  if (c?.companyId) setLinkCompany(c.companyId);
                }}
              >
                <option value="">— none —</option>
                {contacts.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Company</label>
              <select className="input" value={linkCompany} onChange={(e) => setLinkCompany(e.target.value)}>
                <option value="">— none —</option>
                {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-secondary" onClick={() => setLinkFor(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveLink} disabled={linkBusy}>{linkBusy ? "Saving…" : "Save link"}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
