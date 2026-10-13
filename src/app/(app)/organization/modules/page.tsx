"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Alert, api } from "@/components/ui";
import { useSession } from "@/components/SessionProvider";
import OrgSectionNav from "@/components/org/OrgSectionNav";
import { MODULES, GROUP_ORDER } from "@/lib/permissions";

export default function ModulesPage() {
  const session = useSession();
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ enabledModules: string[] | null }>("/api/permissions")
      .then((d) => setEnabledModules(d.enabledModules))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load modules"))
      .finally(() => setLoaded(true));
  }, []);

  const available = useMemo(
    () => MODULES.filter((m) => !m.platformOnly),
    []
  );
  const isEnabled = (key: string) => enabledModules === null || enabledModules.includes(key);
  const planTotal = available.length;
  const planIncluded = available.filter((m) => isEnabled(m.key)).length;

  const grouped = useMemo(() => {
    const map = new Map<string, typeof available>();
    for (const def of available) {
      if (!map.has(def.group)) map.set(def.group, []);
      map.get(def.group)!.push(def);
    }
    return [...map.entries()].sort(
      (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0])
    );
  }, [available]);

  return (
    <>
      <div className="mb-6"><OrgSectionNav /></div>
      <PageHeader
        title="Modules & features"
        subtitle="What your plan includes, and how to give it to your team."
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {!loaded && <p className="text-sm text-slate-500">Loading…</p>}

      {loaded && !error && (
        <>
          <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your plan</p>
              <p className="mt-1 text-lg font-bold text-slate-800">
                {enabledModules === null
                  ? `All ${planTotal} modules enabled`
                  : `${planIncluded} of ${planTotal} modules enabled`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Modules not in your plan are hidden everywhere and cannot be granted. Contact your provider to change your plan.
              </p>
            </div>
            {session.role === "admin" && (
              <p className="text-right text-sm text-slate-600">
                Give modules to roles in{" "}
                <Link href="/organization/permissions" className="font-semibold text-indigo-600 hover:underline">
                  Permissions
                </Link>
                .
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {grouped.map(([group, mods]) => (
              <div key={group} className="card p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-600">{group}</h2>
                <ul className="space-y-1.5">
                  {mods.map((m) => {
                    const on = isEnabled(m.key);
                    return (
                      <li key={m.key} className="flex items-center justify-between gap-3 text-sm">
                        <span className={on ? "text-slate-700" : "text-slate-400 line-through"}>{m.label}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {on ? "Included" : "Not in plan"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
