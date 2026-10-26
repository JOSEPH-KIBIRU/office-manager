"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Alert, api } from "@/components/ui";
import { useSession } from "@/components/SessionProvider";
import { usePermissions } from "@/components/usePermissions";

interface Counts {
  companies?: number;
  contacts?: number;
  leads?: number;
  deals?: number;
  quotations?: number;
}

export default function CrmOverviewPage() {
  const session = useSession();
  const { modules } = usePermissions();
  const [counts, setCounts] = useState<Counts>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const has = (key: string) => Array.isArray(modules) && modules.includes(key);
  const hasAnyArea = has("crm-companies") || has("crm-leads") || has("crm-pipeline") || has("crm-quotations");

  useEffect(() => {
    if (modules === null) return;
    let active = true;
    const enabled = (key: string) => Array.isArray(modules) && modules.includes(key);

    (async () => {
      try {
        const next: Counts = {};
        if (enabled("crm-companies")) {
          const [c, p] = await Promise.all([
            api<{ companies: unknown[] }>("/api/crm/companies"),
            api<{ contacts: unknown[] }>("/api/crm/contacts"),
          ]);
          next.companies = c.companies.length;
          next.contacts = p.contacts.length;
        }
        if (enabled("crm-leads")) {
          const l = await api<{ leads: Array<{ status: string }> }>("/api/crm/leads");
          next.leads = l.leads.filter((x) => x.status !== "converted" && x.status !== "disqualified").length;
        }
        if (enabled("crm-pipeline")) {
          const d = await api<{ deals: Array<{ status: string }> }>("/api/crm/deals?status=open");
          next.deals = d.deals.length;
        }
        if (enabled("crm-quotations")) {
          const q = await api<{ quotations: unknown[] }>("/api/crm/quotations");
          next.quotations = q.quotations.length;
        }
        if (active) setCounts(next);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load CRM summary");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [modules]);

  if (Array.isArray(modules) && !has("crm")) {
    return (
      <>
        <PageHeader title="CRM" />
        <Alert kind="error">You do not have access to the CRM.</Alert>
      </>
    );
  }

  const cards: Array<{ label: string; key: string; value?: number; href?: string }> = [
    { label: "Companies", key: "crm-companies", value: counts.companies, href: "/crm/companies" },
    { label: "Contacts", key: "crm-companies", value: counts.contacts, href: "/crm/contacts" },
    { label: "Open leads", key: "crm-leads", value: counts.leads },
    { label: "Open deals", key: "crm-pipeline", value: counts.deals },
    { label: "Quotations", key: "crm-quotations", value: counts.quotations },
  ];

  return (
    <>
      <PageHeader
        title="CRM"
        subtitle="Companies, contacts, leads, pipeline and quotations — linked to your accounting."
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => {
          const body = (
            <>
              <p className="text-sm text-slate-500">{c.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-800">
                {!has(c.key) ? "—" : loading ? "…" : c.value ?? 0}
              </p>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="card p-5 transition hover:border-indigo-200 hover:bg-indigo-50/40">
              {body}
            </Link>
          ) : (
            <div key={c.label} className="card p-5">{body}</div>
          );
        })}
      </div>

      {!hasAnyArea && (
        <div className="card mb-6 p-6">
          <p className="text-sm text-slate-600">
            You have the CRM overview, but no CRM areas have been granted to your role yet.{" "}
            {session.role === "admin" ? (
              <>
                Enable them under{" "}
                <Link href="/organization/permissions" className="font-semibold text-indigo-600 hover:underline">
                  Roles &amp; permissions
                </Link>
                .
              </>
            ) : (
              <>Ask your administrator to grant CRM access.</>
            )}
          </p>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-600">Workspace</h2>
        <p className="mt-2 text-sm text-slate-500">
          The CRM is being delivered in stages. Companies &amp; contacts, leads &amp; pipelines,
          quotations and email integrations will appear in the sidebar as each area ships. Accounting
          invoices and payments remain the source of truth — the CRM only references them.
        </p>
      </div>
    </>
  );
}
