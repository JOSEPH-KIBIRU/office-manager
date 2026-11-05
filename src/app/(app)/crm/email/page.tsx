"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Alert, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePermissions } from "@/components/usePermissions";

interface Connection {
  id: string;
  provider: "gmail" | "outlook";
  email: string | null;
  status: "active" | "error";
  lastError: string | null;
  lastSyncedAt: number | null;
}
interface Providers {
  gmail: { label: string; configured: boolean };
  outlook: { label: string; configured: boolean };
}

const PROVIDER_IDS = ["gmail", "outlook"] as const;

function fmt(ms: number | null) {
  return ms ? new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never";
}

export default function CrmEmailPage() {
  const toast = useToast();
  const { modules, can } = usePermissions();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ connections: Connection[]; providers: Providers }>("/api/crm/integrations");
      setConnections(data.connections);
      setProviders(data.providers);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("email");
    if (result) {
      if (result === "connected") toast.success("Email account connected. Messages will sync shortly.");
      else toast.error("Could not connect the email account. Please try again.");
      window.history.replaceState({}, "", "/crm/email");
      setTimeout(() => load(), 1500);
    }
  }, [toast, load]);

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

  async function disconnect(provider: "gmail" | "outlook") {
    if (!confirm(`Disconnect ${provider === "gmail" ? "Gmail" : "Outlook"}?`)) return;
    setBusy(provider);
    try {
      await api(`/api/crm/integrations/${provider}/disconnect`, { method: "POST" });
      toast.success("Disconnected");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setBusy(null);
    }
  }

  if (Array.isArray(modules) && !can("crm-email")) {
    return (
      <>
        <PageHeader title="Email" />
        <Alert kind="error">You do not have access to CRM email integrations.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Email"
        subtitle="Connect a mailbox so emails can be linked to companies, contacts and deals."
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={syncNow} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            <Link href="/crm/email/inbox" className="btn-primary">Open inbox</Link>
          </div>
        }
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {loading && <p className="text-sm text-slate-500">Loading integrations…</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PROVIDER_IDS.map((id) => {
          const cfg = providers?.[id];
          const conn = connections.find((c) => c.provider === id);
          return (
            <div key={id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">{cfg?.label ?? id}</h2>
                  <p className="mt-1 text-xs text-slate-500">Read-only mail access (Mail.Read / gmail.readonly).</p>
                </div>
                {conn ? (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${conn.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {conn.status}
                  </span>
                ) : null}
              </div>

              {conn ? (
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>Connected as <strong>{conn.email ?? "unknown mailbox"}</strong></p>
                  <p className="text-xs text-slate-500">Last synced: {fmt(conn.lastSyncedAt)}</p>
                  {conn.status === "error" && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <p className="font-semibold">Access expired or was revoked.</p>
                      <p>{conn.lastError ?? "Reconnect to re-authorise this mailbox."}</p>
                    </div>
                  )}
                  {conn.status !== "error" && conn.lastError && (
                    <p className="text-xs text-red-600">{conn.lastError}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      className="btn-primary px-3 py-1.5 text-sm"
                      href={`/api/crm/integrations/${id}/connect`}
                    >
                      Reconnect {cfg?.label ?? id}
                    </a>
                    <button className="btn-danger px-3 py-1.5 text-sm" onClick={() => disconnect(id)} disabled={busy === id}>
                      {busy === id ? "Working…" : "Disconnect"}
                    </button>
                  </div>
                </div>
              ) : cfg && !cfg.configured ? (
                <p className="mt-3 text-sm text-slate-500">Not configured by your provider yet.</p>
              ) : (
                <div className="mt-3">
                  <a className="btn-primary inline-block px-4 py-2 text-sm" href={`/api/crm/integrations/${id}/connect`}>
                    Connect {cfg?.label ?? id}
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-slate-600">How it works</h2>
        <p className="mt-2 text-sm text-slate-500">
          Connecting grants read-only access to the mailbox. Tokens are encrypted on the server and are
          never sent to the browser. Synced emails are matched to CRM contacts by email address and to
          companies by contact or email domain. No emails are sent in this phase.
        </p>
      </div>
    </>
  );
}
