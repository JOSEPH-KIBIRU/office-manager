"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/types";
import type { ApiOrg } from "@/components/OrgBranding";

interface U {
  id: string;
  name: string;
  role: Role;
  department_id: string | null;
  active: number;
}
interface Dept {
  id: string;
  name: string;
}

function Node({ name, sub, tone }: { name: string; sub?: string; tone?: string }) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-center shadow-sm ${tone ?? "border-slate-200 bg-white"}`}>
      <p className="text-sm font-semibold text-slate-800">{name}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

export default function OrgChartPage() {
  const [users, setUsers] = useState<U[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [org, setOrg] = useState<ApiOrg | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ users: U[] }>("/api/users?full=1").catch(() => ({ users: [] as U[] })),
      api<{ departments: Dept[] }>("/api/departments").catch(() => ({ departments: [] as Dept[] })),
      api<ApiOrg>("/api/organization").catch(() => null),
    ]).then(([u, d, o]) => {
      setUsers(u.users.filter((x) => x.active === 1));
      setDepts(d.departments);
      setOrg(o);
    });
  }, []);

  const admins = useMemo(() => users.filter((u) => u.role === "admin"), [users]);
  const unassigned = useMemo(() => users.filter((u) => !u.department_id && u.role !== "admin"), [users]);
  const byDept = useMemo(() => {
    const m = new Map<string, U[]>();
    for (const u of users) if (u.department_id) {
      if (!m.has(u.department_id)) m.set(u.department_id, []);
      m.get(u.department_id)!.push(u);
    }
    return m;
  }, [users]);

  return (
    <>
      <PageHeader title="Org chart" subtitle="How the company is structured — leadership, departments and teams." />
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="card p-6">
        {/* Leadership */}
        <div className="flex flex-col items-center">
          <Node name={org?.name || "Company"} sub="Company" tone="border-indigo-300 bg-indigo-50" />
          <div className="my-2 h-6 w-px bg-slate-300" />
          <div className="flex flex-wrap justify-center gap-3">
            {admins.map((a) => <Node key={a.id} name={a.name} sub={ROLE_LABELS[a.role]} tone="border-indigo-200 bg-indigo-50/60" />)}
            {admins.length === 0 && <Node name="No admin" sub="—" />}
          </div>
        </div>

        {/* Departments */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {depts.map((d) => {
            const members = byDept.get(d.id) ?? [];
            return (
              <div key={d.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-bold text-slate-700">{d.name}</p>
                <div className="space-y-2">
                  {members.map((m) => (
                    <Node key={m.id} name={m.name} sub={ROLE_LABELS[m.role]} />
                  ))}
                  {members.length === 0 && <p className="text-xs text-slate-400">No members</p>}
                </div>
              </div>
            );
          })}
          {unassigned.length > 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-4">
              <p className="mb-3 text-sm font-bold text-slate-500">Unassigned</p>
              <div className="space-y-2">
                {unassigned.map((m) => <Node key={m.id} name={m.name} sub={ROLE_LABELS[m.role]} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
