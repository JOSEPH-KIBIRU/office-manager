"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, PageHeader, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";

function MenuItem({
  onClick,
  href,
  children,
  danger,
}: {
  onClick?: () => void;
  href?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  const cls = `block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${danger ? "text-red-600" : "text-slate-700"}`;
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** Compact actions dropdown that escapes the table's overflow clipping. */
function RowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      // Ignore clicks on the trigger and inside the menu — otherwise the menu
      // unmounts on mousedown and the item's click never fires.
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, r.right - 196) });
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn-secondary btn-xs"
      >
        Actions ▾
      </button>
      {open && pos && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 196 }}
          className="z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </>
  );
}

interface AdminDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  last_login_at: string | null;
  last_login_ms: number | null;
  must_change_password: boolean;
  active: boolean;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  archived: boolean;
  deleted_at: string | null;
  users: number;
  admin_details: AdminDetail[];
  last_accessed_at: string | null;
  last_accessed_ms: number | null;
  created_at: string;
  created_ms: number;
}

/** Format an epoch timestamp in East Africa Time (Africa/Nairobi, UTC+3). */
function fmtEAT(ms: number | null | undefined): string {
  if (!ms) return "—";
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
  return `${s} EAT`;
}

/** Compact "x ago" relative time. */
function timeAgo(ms: number | null | undefined): string {
  if (!ms) return "";
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Snapshot {
  id: string;
  kind: string;
  size: number;
  counts: Record<string, number> | null;
  createdAt: number;
  url: string | null;
}

function kb(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function CompaniesPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingOrg, setPendingOrg] = useState<Company | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const [pendingArchive, setPendingArchive] = useState<Company | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Company | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [backupsFor, setBackupsFor] = useState<Company | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotsBusy, setSnapshotsBusy] = useState(false);
  const [restoreFor, setRestoreFor] = useState<Snapshot | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);

  // Admin password reset
  const [adminsFor, setAdminsFor] = useState<Company | null>(null);
  const [resetFor, setResetFor] = useState<AdminDetail | null>(null);
  const [resetSendSms, setResetSendSms] = useState(true);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResult, setResetResult] = useState<{
    name: string;
    email: string;
    phoneMasked: string | null;
    tempPassword: string;
    smsSent: boolean;
    smsError: string | null;
  } | null>(null);

  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ orgs: Company[] }>("/api/admin/companies");
      setOrgs(data.orgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Keep "last access" fresh in near real time.
    const id = setInterval(() => { load(); }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function viewCompany(c: Company) {
    setError(null);
    try {
      await api(`/api/admin/impersonate`, { method: "POST", json: { orgId: c.id } });
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open company");
    }
  }

  async function toggleOrg() {
    const o = pendingOrg;
    if (!o) return;
    setToggleBusy(true);
    setError(null);
    try {
      await api(`/api/admin/companies/${o.id}`, { method: "PATCH", json: { active: o.active } });
      toast.success(`${o.name} ${o.active ? "reactivated" : "suspended"}.`);
      setPendingOrg(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setToggleBusy(false);
    }
  }

  async function toggleArchive() {
    const o = pendingArchive;
    if (!o) return;
    setArchiveBusy(true);
    setError(null);
    try {
      await api(`/api/admin/companies/${o.id}`, { method: "PATCH", json: { archived: o.archived } });
      toast.success(`${o.name} ${o.archived ? "archived" : "restored"}.`);
      setPendingArchive(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setArchiveBusy(false);
    }
  }

  async function doDelete() {
    const o = pendingDelete;
    if (!o || deleteText.trim() !== o.name) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await api<{ rows: number; snapshotId: string | null }>(
        `/api/admin/companies/${o.id}`,
        { method: "DELETE" }
      );
      toast.success(`${o.name} permanently deleted (${res.rows} records).`);
      setPendingDelete(null);
      setDeleteText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function openBackups(c: Company) {
    setBackupsFor(c);
    setSnapshots([]);
    setSnapshotsBusy(true);
    try {
      const data = await api<{ snapshots: Snapshot[] }>(`/api/admin/companies/${c.id}/backups`);
      setSnapshots(data.snapshots);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load backups");
    } finally {
      setSnapshotsBusy(false);
    }
  }

  async function createSnapshot() {
    if (!backupsFor) return;
    setSnapshotsBusy(true);
    try {
      await api(`/api/admin/companies/${backupsFor.id}/backup`, { method: "POST" });
      toast.success("Backup snapshot created.");
      await openBackups(backupsFor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create backup");
      setSnapshotsBusy(false);
    }
  }

  async function removeSnapshot(id: string) {
    if (!backupsFor) return;
    setSnapshotsBusy(true);
    try {
      await api(`/api/admin/companies/${backupsFor.id}/backups?snapshotId=${id}`, { method: "DELETE" });
      await openBackups(backupsFor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete backup");
      setSnapshotsBusy(false);
    }
  }

  async function doRestore() {
    const snap = restoreFor;
    if (!backupsFor || !snap) return;
    setRestoreBusy(true);
    setError(null);
    try {
      const res = await api<{ restored: number }>(`/api/admin/companies/${backupsFor.id}/restore`, {
        method: "POST",
        json: { snapshotId: snap.id },
      });
      toast.success(`Company restored (${res.restored} records rebuilt).`);
      setRestoreFor(null);
      await openBackups(backupsFor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoreBusy(false);
    }
  }

  const canDelete = pendingDelete && deleteText.trim() === pendingDelete.name;

  async function doResetPassword() {
    if (!resetFor) return;
    setResetBusy(true);
    setError(null);
    try {
      const res = await api<{
        tempPassword: string;
        smsSent: boolean;
        smsError: string | null;
        name: string;
        email: string;
        phoneMasked: string | null;
      }>(`/api/admin/admins/${resetFor.id}/reset`, { method: "POST", json: { sendSms: resetSendSms } });
      setResetResult(res);
      toast.success(res.smsSent ? "New password texted to the admin." : "Password reset — copy it and share it.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetBusy(false);
    }
  }

  function copyPassword(pw: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(pw).then(() => toast.success("Password copied")).catch(() => toast.error("Copy failed"));
    } else {
      toast.error("Copy is not supported in this browser");
    }
  }

  const stats = {
    total: orgs.length,
    active: orgs.filter((o) => o.active && !o.archived).length,
    paused: orgs.filter((o) => !o.active || o.archived).length,
    users: orgs.reduce((s, o) => s + o.users, 0),
  };

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle="Every organization on the platform — see admins, last access, and reset a forgotten admin password by text or copy."
        action={<Link href="/admin/new" className="btn-primary">+ Create company & admin</Link>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Companies", value: stats.total, tone: "bg-indigo-50 text-indigo-700" },
          { label: "Active", value: stats.active, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Suspended / archived", value: stats.paused, tone: "bg-amber-50 text-amber-700" },
          { label: "Total users", value: stats.users, tone: "bg-sky-50 text-sky-700" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className={`mt-1 inline-flex rounded-lg px-2 py-0.5 text-2xl font-bold ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-44 animate-pulse" />
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">No companies yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {orgs.map((o) => (
            <div key={o.id} className={`card flex flex-col p-5 ${o.archived ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-slate-900">
                    {o.name}
                    {o.slug === "__platform" && <span className="ml-2 text-xs font-normal text-slate-400">(platform)</span>}
                  </h3>
                  <p className="truncate text-xs text-slate-400">{o.slug}</p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  {o.archived ? (
                    <span className="badge bg-amber-100 text-amber-800">archived</span>
                  ) : (
                    <span className={`badge ${o.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                      {o.active ? "active" : "suspended"}
                    </span>
                  )}
                  {o.slug !== "__platform" && (
                    <RowMenu>
                      <MenuItem onClick={() => viewCompany(o)}>Open dashboard</MenuItem>
                      <MenuItem onClick={() => { setAdminsFor(o); setResetResult(null); }}>Admins &amp; passwords</MenuItem>
                      <MenuItem onClick={() => openBackups(o)}>Backups / snapshots</MenuItem>
                      <MenuItem href={`/api/admin/companies/${o.id}/backup`}>Download JSON backup</MenuItem>
                      <div className="my-1 border-t border-slate-100" />
                      <MenuItem onClick={() => setPendingArchive({ ...o, archived: !o.archived })}>
                        {o.archived ? "Restore company" : "Archive company"}
                      </MenuItem>
                      {!o.archived && (
                        <MenuItem onClick={() => setPendingOrg({ ...o, active: !o.active })}>
                          {o.active ? "Suspend logins" : "Reactivate logins"}
                        </MenuItem>
                      )}
                      <div className="my-1 border-t border-slate-100" />
                      <MenuItem danger onClick={() => { setPendingDelete(o); setDeleteText(""); }}>
                        Delete permanently
                      </MenuItem>
                    </RowMenu>
                  )}
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Users</dt>
                  <dd className="text-lg font-bold text-slate-800">{o.users}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Last access</dt>
                  <dd className="text-sm font-semibold text-slate-800">
                    {o.last_accessed_ms ? (
                      <>
                        {fmtEAT(o.last_accessed_ms)}
                        <span className="ml-1 text-xs font-normal text-slate-400">· {timeAgo(o.last_accessed_ms)}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">Never</span>
                    )}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Created</dt>
                  <dd className="truncate text-sm font-semibold text-slate-800" title={fmtEAT(o.created_ms)}>
                    {fmtEAT(o.created_ms)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Admins</p>
                {o.admin_details.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-400">No admins</p>
                ) : (
                  <ul className="mt-1.5 space-y-1.5">
                    {o.admin_details.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
                        <span className="min-w-0 truncate">
                          <span className="font-medium text-slate-800">{a.name}</span>
                          <span className="ml-1 text-slate-400">{a.email}</span>
                        </span>
                        <span className="text-xs text-slate-400">
                          {a.last_login_ms ? `last login ${fmtEAT(a.last_login_ms)} · ${timeAgo(a.last_login_ms)}` : "never signed in"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suspend / reactivate */}
      <ConfirmDialog
        open={!!pendingOrg}
        title={pendingOrg?.active ? "Reactivate company" : "Suspend company"}
        message={
          pendingOrg?.active
            ? <span>Reactivate <strong>{pendingOrg.name}</strong>? Its users can log in again.</span>
            : <span>Suspend <strong>{pendingOrg?.name}</strong>? Its users will no longer be able to log in.</span>
        }
        confirmLabel={pendingOrg?.active ? "Reactivate" : "Suspend"}
        busy={toggleBusy}
        onConfirm={toggleOrg}
        onCancel={() => setPendingOrg(null)}
      />

      {/* Archive / restore (soft delete) */}
      <ConfirmDialog
        open={!!pendingArchive}
        title={pendingArchive?.archived ? "Restore company" : "Archive company"}
        message={
          pendingArchive?.archived
            ? <span>Restore <strong>{pendingArchive.name}</strong>? Its users can log in again and the company reappears as active.</span>
            : <span>Archive <strong>{pendingArchive?.name}</strong>? Its users will be blocked from logging in. All data is kept and the company can be restored at any time.</span>
        }
        confirmLabel={pendingArchive?.archived ? "Restore" : "Archive"}
        busy={archiveBusy}
        onConfirm={toggleArchive}
        onCancel={() => setPendingArchive(null)}
      />

      {/* Permanent delete */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-md p-5">
            <h3 className="text-lg font-bold text-red-700">Delete company permanently</h3>
            <p className="mt-2 text-sm text-slate-600">
              This permanently deletes <strong>{pendingDelete.name}</strong> and all of its data
              (users, payroll, accounting, files and more). A safety backup is taken automatically
              first, but this action cannot be undone from here.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Type <strong>{pendingDelete.name}</strong> to confirm.
            </p>
            <input
              className="input mt-2"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={pendingDelete.name}
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => { setPendingDelete(null); setDeleteText(""); }} disabled={deleteBusy}>
                Cancel
              </button>
              <button className="btn-danger" onClick={doDelete} disabled={!canDelete || deleteBusy}>
                {deleteBusy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshots modal */}
      {backupsFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Backups — {backupsFor.name}</h3>
                <p className="text-xs text-slate-500">Point-in-time snapshots stored securely. Download any snapshot as JSON.</p>
              </div>
              <button onClick={() => setBackupsFor(null)} className="text-xl leading-none text-slate-400 hover:text-slate-600">×</button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <a href={`/api/admin/companies/${backupsFor.id}/backup`} className="btn-secondary text-xs">
                Download current backup
              </a>
              <button onClick={createSnapshot} disabled={snapshotsBusy} className="btn-primary text-xs">
                {snapshotsBusy ? "Working…" : "Create snapshot"}
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
              {snapshots.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  {snapshotsBusy ? "Loading…" : "No snapshots yet."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {snapshots.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {new Date(s.createdAt).toLocaleString()}
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                            {s.kind.replace("_", " ")}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {kb(s.size)} · {s.counts?.users ?? 0} users · {s.counts?.invoices ?? 0} invoices · {s.counts?.journals ?? 0} journals
                        </p>
                      </div>
                      <div className="flex flex-none gap-1">
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-xs">
                            Download
                          </a>
                        )}
                        <button
                          onClick={() => setRestoreFor(s)}
                          disabled={snapshotsBusy}
                          className="btn-secondary btn-xs text-amber-700"
                        >
                          Restore
                        </button>
                        <button onClick={() => removeSnapshot(s.id)} disabled={snapshotsBusy} className="btn-secondary btn-xs text-red-600">
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Restore from snapshot */}
      <ConfirmDialog
        open={!!restoreFor}
        title="Restore company from snapshot"
        message={
          <span>
            Restore <strong>{backupsFor?.name}</strong> to the state captured at{" "}
            <strong>{restoreFor ? new Date(restoreFor.createdAt).toLocaleString() : ""}</strong>? This
            replaces all current data with the snapshot. A fresh safety snapshot is taken first, but
            the current data will be overwritten.
          </span>
        }
        confirmLabel="Restore"
        busy={restoreBusy}
        onConfirm={doRestore}
        onCancel={() => setRestoreFor(null)}
      />

      {/* Admins & password reset */}
      {adminsFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Admins — {adminsFor.name}</h3>
                <p className="text-xs text-slate-500">Reset a forgotten password, then text it to the admin or copy it to share.</p>
              </div>
              <button onClick={() => { setAdminsFor(null); setResetResult(null); setResetFor(null); }} className="text-xl leading-none text-slate-400 hover:text-slate-600">×</button>
            </div>

            {resetResult ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">Password reset for {resetResult.name}</p>
                <p className="mt-1 text-xs text-emerald-700">
                  {resetResult.smsSent
                    ? `Texted to ${resetResult.phoneMasked ?? "the admin's phone"}.`
                    : resetResult.smsError ?? "Copy the password below and share it securely."}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-sm tracking-wide">{resetResult.tempPassword}</code>
                  <button className="btn-primary" onClick={() => copyPassword(resetResult.tempPassword)}>Copy</button>
                </div>
                <p className="mt-2 text-xs text-emerald-700">
                  Login: <strong>{resetResult.email}</strong> · the admin must change it after signing in.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button className="btn-secondary" onClick={() => { setResetResult(null); setResetFor(null); }}>Back to admins</button>
                  <button className="btn-secondary" onClick={() => { setAdminsFor(null); setResetResult(null); setResetFor(null); }}>Done</button>
                </div>
              </div>
            ) : adminsFor.admin_details.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">This company has no admin accounts.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {adminsFor.admin_details.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {a.name}
                        {a.must_change_password && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">temp password</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {a.email}
                        {a.phone ? ` · ${a.phone}` : " · no phone on file"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Last sign-in: {a.last_login_ms ? `${fmtEAT(a.last_login_ms)} · ${timeAgo(a.last_login_ms)}` : "Never"}
                      </p>
                    </div>
                    <button
                      className="btn-secondary btn-xs"
                      onClick={() => { setResetFor(a); setResetSendSms(!!a.phone); }}
                    >
                      Reset password
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {resetFor && !resetResult && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">Reset password for {resetFor.name}?</p>
                <p className="mt-1 text-xs text-amber-700">
                  A new temporary password will be generated and they must change it at their next login.
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm text-amber-800">
                  <input
                    type="checkbox"
                    checked={resetSendSms}
                    disabled={!resetFor.phone}
                    onChange={(e) => setResetSendSms(e.target.checked)}
                    className="h-4 w-4"
                  />
                  {resetFor.phone ? `Text the new password to ${resetFor.phone}` : "No phone number on file — you'll copy it instead"}
                </label>
                <div className="mt-3 flex justify-end gap-2">
                  <button className="btn-secondary" onClick={() => setResetFor(null)} disabled={resetBusy}>Cancel</button>
                  <button className="btn-danger" onClick={doResetPassword} disabled={resetBusy}>
                    {resetBusy ? "Resetting…" : "Reset password"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
