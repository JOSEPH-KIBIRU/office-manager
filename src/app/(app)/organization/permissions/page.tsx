"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import OrgSectionNav from "@/components/org/OrgSectionNav";
import {
  MODULES,
  ORG_ROLES,
  ROLE_LABELS,
  type ModuleKey,
  type OrgRole,
} from "@/lib/permissions";

type Config = Record<string, { granted: string[]; overridden: boolean }>;

const GROUP_ORDER = ["Overview", "People & HR", "Finance", "Management", "Reporting", "Operations", "Company"];

export default function PermissionsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  const [customRoles, setCustomRoles] = useState<{ key: string; label: string }[]>([]);
  const [role, setRole] = useState<string>("secretary");
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [removeFor, setRemoveFor] = useState<string | null>(null);
  const toast = useToast();

  function applyConfig(d: {
    config: Config;
    enabledModules: string[] | null;
    customRoles: { key: string; label: string }[];
  }) {
    setConfig(d.config);
    setEnabledModules(d.enabledModules);
    setCustomRoles(d.customRoles);
  }

  useEffect(() => {
    api<{ config: Config; enabledModules: string[] | null; customRoles: { key: string; label: string }[] }>(
      "/api/permissions"
    )
      .then((d) => {
        applyConfig(d);
        setGranted(new Set(d.config.secretary?.granted ?? []));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load permissions"))
      .finally(() => setLoading(false));
  }, []);

  // Modules the platform allows this company (null = all). Platform-only modules
  // (e.g. the audit log) are controlled by the platform console only.
  const availableModules = useMemo(
    () => MODULES.filter((m) => !m.platformOnly && (!enabledModules || enabledModules.includes(m.key))),
    [enabledModules]
  );

  const planTotal = MODULES.filter((m) => !m.platformOnly).length;
  const planIncluded = MODULES.filter(
    (m) => !m.platformOnly && (!enabledModules || enabledModules.includes(m.key))
  ).length;

  const allRoles = [...ORG_ROLES, ...customRoles.map((c) => c.key)];
  const isBuiltin = (r: string) => (ORG_ROLES as string[]).includes(r);
  const roleLabel = (r: string) =>
    isBuiltin(r) ? ROLE_LABELS[r as OrgRole] : customRoles.find((c) => c.key === r)?.label ?? r;
  const selectedIsCustom = customRoles.some((c) => c.key === role);

  function selectRole(r: string) {
    setRole(r);
    setGranted(new Set(config?.[r]?.granted ?? []));
    setSaved(false);
  }

  function toggle(m: string) {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/permissions`, {
        method: "PATCH",
        json: { role, permissions: Array.from(granted) },
      });
      setConfig((prev) => (prev ? { ...prev, [role]: { granted: Array.from(granted), overridden: true } } : prev));
      setSaved(true);
      toast.success(`Permissions for ${roleLabel(role)} saved`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save permissions");
    } finally {
      setBusy(false);
    }
  }

  async function addRole() {
    const label = newRole.trim();
    if (!label) return;
    setRoleBusy(true);
    setError(null);
    try {
      const res = await api<{ key: string; customRoles: { key: string; label: string }[] }>(
        "/api/permissions",
        { method: "POST", json: { action: "addRole", label } }
      );
      setNewRole("");
      const d = await api<{ config: Config; enabledModules: string[] | null; customRoles: { key: string; label: string }[] }>(
        "/api/permissions"
      );
      applyConfig(d);
      selectRole(res.key);
      toast.success(`Role "${label}" added`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add role");
    } finally {
      setRoleBusy(false);
    }
  }

  async function removeRole(key: string) {
    setRoleBusy(true);
    setError(null);
    try {
      await api("/api/permissions", { method: "POST", json: { action: "removeRole", key } });
      const d = await api<{ config: Config; enabledModules: string[] | null; customRoles: { key: string; label: string }[] }>(
        "/api/permissions"
      );
      applyConfig(d);
      selectRole("secretary");
      toast.success("Role removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove role");
    } finally {
      setRoleBusy(false);
      setRemoveFor(null);
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, { key: ModuleKey; label: string }[]>();
    for (const def of availableModules) {
      const list = map.get(def.group) ?? [];
      list.push({ key: def.key, label: def.label });
      map.set(def.group, list);
    }
    return map;
  }, [availableModules]);

  const currentOverridden = config?.[role]?.overridden ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & permissions"
        subtitle="Choose which modules each role can open. Directors always keep full access. Add your own roles if you need more."
      />

      <OrgSectionNav />

      {error && <Alert kind="error">{error}</Alert>}

      {enabledModules && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Your plan includes {planIncluded} of {planTotal} modules. Modules not included
          in your plan are hidden here and cannot be granted. Contact support to enable more.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading permissions…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {allRoles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => selectRole(r)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  role === r
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {roleLabel(r)}
                {r === "admin" && <span className="ml-1 text-xs font-normal opacity-70">(full)</span>}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input max-w-[14rem]"
              value={newRole}
              placeholder="Add a role, e.g. Supervisor"
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRole();
                }
              }}
            />
            <button type="button" className="btn-secondary" disabled={roleBusy || !newRole.trim()} onClick={addRole}>
              + Add role
            </button>
            {selectedIsCustom && (
              <button
                type="button"
                className="btn-secondary text-red-600"
                disabled={roleBusy}
                onClick={() => setRemoveFor(role)}
              >
                Remove “{roleLabel(role)}”
              </button>
            )}
          </div>

          {role === "admin" ? (
            <div className="card max-w-2xl p-6 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">The Director role always has full access.</p>
              <p className="mt-2">
                Directors can open every module and manage roles, settings, payroll, finance and
                company data. This role cannot be restricted.
              </p>
            </div>
          ) : (
            <div className="card max-w-3xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{roleLabel(role)}</h3>
                  <p className="text-xs text-slate-500">
                    {currentOverridden
                      ? "Custom permissions are in effect for this role."
                      : "Using the default permissions for this role."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => setGranted(new Set())}
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => setGranted(new Set(availableModules.map((m) => m.key)))}
                  >
                    Select all
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                {GROUP_ORDER.map((g) => {
                  const items = groups.get(g);
                  if (!items?.length) return null;
                  return (
                    <fieldset key={g}>
                      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {g}
                      </legend>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {items.map((m) => (
                          <label
                            key={m.key}
                            className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={granted.has(m.key)}
                              onChange={() => toggle(m.key)}
                              className="h-4 w-4"
                            />
                            {m.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-5">
                <button type="button" className="btn-primary px-5 py-2.5" disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Save permissions"}
                </button>
                {saved && <span className="text-sm text-emerald-600">Saved.</span>}
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={removeFor !== null}
        title="Remove role"
        message={
          <>
            Remove the role <strong>{removeFor ? roleLabel(removeFor) : ""}</strong> and its permissions?
            This cannot be undone.
          </>
        }
        confirmLabel="Remove"
        busy={roleBusy}
        onConfirm={() => removeFor && removeRole(removeFor)}
        onCancel={() => setRemoveFor(null)}
      />
    </div>
  );
}
