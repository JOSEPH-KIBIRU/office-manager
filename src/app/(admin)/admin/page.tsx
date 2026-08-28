"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, PageHeader, api } from "@/components/ui";

interface Company {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  users: number;
  admins: string[];
  created_at: string;
}

export default function CompaniesPage() {
  const [orgs, setOrgs] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<{ orgs: Company[] }>("/api/admin/companies");
      setOrgs(data.orgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load companies");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleOrg(id: string, active: boolean, name: string) {
    if (!window.confirm(`${active ? "Suspend" : "Reactivate"} ${name}? ${active ? "Its users will no longer be able to log in." : ""}`)) return;
    setError(null);
    try {
      await api(`/api/admin/companies/${id}`, { method: "PATCH", json: { active } });
      setNotice(`${name} ${active ? "reactivated" : "suspended"}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle="All organizations on the platform. Suspend a company to block its users from logging in."
        action={<Link href="/admin/new" className="btn-primary">+ Create company & admin</Link>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Company</th>
              <th>Admins</th>
              <th className="text-right">Users</th>
              <th>Created</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id}>
                <td className="font-medium">
                  {o.name}
                  {o.slug === "__platform" && <span className="ml-2 text-xs text-slate-400">(platform)</span>}
                </td>
                <td>{o.admins.join(", ") || "—"}</td>
                <td className="text-right">{o.users}</td>
                <td className="text-slate-500">{o.created_at}</td>
                <td>
                  <span className={`badge ${o.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                    {o.active ? "active" : "suspended"}
                  </span>
                </td>
                <td className="whitespace-nowrap text-right">
                  {o.slug !== "__platform" && (
                    <button
                      onClick={() => toggleOrg(o.id, !o.active, o.name)}
                      className={`btn-secondary px-2 py-1 text-xs ${o.active ? "text-red-600" : "text-emerald-700"}`}
                    >
                      {o.active ? "Suspend" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
