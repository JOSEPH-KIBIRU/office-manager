"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { ApiOrg } from "@/components/OrgBranding";

export type OrgDraft = Record<string, unknown>;

const DEFAULTS: OrgDraft = {
  name: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  taxNumber: "",
  website: "",
  paymentDetails: "",
  invoiceNotes: "",
  invoiceTerms: "",
  workingDays: [1, 2, 3, 4, 5],
  workStartTime: "08:00",
  workEndTime: "17:00",
  graceMinutes: 15,
  etimsEnabled: false,
  etimsEnv: "sandbox",
  etimsBaseUrl: "",
  etimsTin: "",
  etimsBhfId: "",
  etimsDeviceSerial: "",
  etimsApiKey: "",
  etimsApiSecret: "",
  remindersEnabled: true,
  reminderIntervalDays: 3,
  reminderMax: 4,
  leaveEntitlement: 21,
  leaveCarryOverMax: 0,
  leaveEncashment: false,
};

/**
 * Shared load/save state for the "Branding & Company" section pages.
 * Each section owns its own fields but reuses one org fetch and one save path.
 */
export function useOrgSettings() {
  const [org, setOrg] = useState<ApiOrg | null>(null);
  const [draft, setDraft] = useState<OrgDraft>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<ApiOrg>("/api/organization");
      setOrg(data);
      setDraft({
        name: data.name || "",
        address: data.address || "",
        city: data.city || "",
        phone: data.phone || "",
        email: data.email || "",
        taxNumber: data.taxNumber || "",
        website: data.website || "",
        paymentDetails: data.paymentDetails || "",
        invoiceNotes: data.invoiceNotes || "",
        invoiceTerms: data.invoiceTerms || "",
        workingDays: data.workingDays?.length ? data.workingDays : [1, 2, 3, 4, 5],
        workStartTime: data.workStartTime || "08:00",
        workEndTime: data.workEndTime || "17:00",
        graceMinutes: data.graceMinutes ?? 15,
        etimsEnabled: !!data.etimsEnabled,
        etimsEnv: data.etimsEnv || "sandbox",
        etimsBaseUrl: data.etimsBaseUrl || "",
        etimsTin: data.etimsTin || "",
        etimsBhfId: data.etimsBhfId || "",
        etimsDeviceSerial: data.etimsDeviceSerial || "",
        etimsApiKey: data.etimsApiKey || "",
        etimsApiSecret: "",
        remindersEnabled: data.remindersEnabled !== false,
        reminderIntervalDays: data.reminderIntervalDays ?? 3,
        reminderMax: data.reminderMax ?? 4,
        leaveEntitlement: data.leaveEntitlement ?? 21,
        leaveCarryOverMax: data.leaveCarryOverMax ?? 0,
        leaveEncashment: data.leaveEncashment === true,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load company details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function set<K extends keyof OrgDraft>(key: K, value: OrgDraft[K]) {
    setDraft((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  function setNumber(key: keyof OrgDraft, raw: string) {
    set(key, raw === "" ? 0 : Number(raw));
  }

  /** Save only the fields owned by the calling section. */
  async function save(keys: readonly (keyof OrgDraft)[], label: string) {
    const patch: OrgDraft = {};
    for (const k of keys) patch[k] = draft[k];
    setBusy(true);
    try {
      const updated = await api<ApiOrg>("/api/organization", { method: "PATCH", json: patch });
      setOrg(updated);
      if (keys.includes("etimsApiSecret")) set("etimsApiSecret", "");
      setSaved(true);
      toast.success(`${label} saved`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Failed to save ${label.toLowerCase()}`;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return { org, draft, set, setNumber, load, save, loading, busy, saved, error, setError };
}

/** Text input bound to one draft field. */
export function OrgField(props: {
  label: string;
  field: keyof OrgDraft;
  draft: OrgDraft;
  set: (k: keyof OrgDraft, v: never) => void;
  placeholder?: string;
  type?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  const { label, field, draft, set, placeholder, type = "text", hint, required, className } = props;
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        className="input"
        type={type}
        value={(draft[field] as string) ?? ""}
        onChange={(e) => set(field, e.target.value as never)}
        placeholder={placeholder}
        required={required}
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Number input bound to one draft field. */
export function OrgNumberField(props: {
  label: string;
  field: keyof OrgDraft;
  draft: OrgDraft;
  setNumber: (k: keyof OrgDraft, raw: string) => void;
  min?: number;
  max?: number;
  hint?: React.ReactNode;
  className?: string;
}) {
  const { label, field, draft, setNumber, min, max, hint, className } = props;
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        className="input"
        type="number"
        min={min}
        max={max}
        value={(draft[field] as number) ?? 0}
        onChange={(e) => setNumber(field, e.target.value)}
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Textarea bound to one draft field. */
export function OrgTextarea(props: {
  label: string;
  field: keyof OrgDraft;
  draft: OrgDraft;
  set: (k: keyof OrgDraft, v: never) => void;
  rows?: number;
  placeholder?: string;
  hint?: React.ReactNode;
}) {
  const { label, field, draft, set, rows = 3, placeholder, hint } = props;
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        className="input"
        rows={rows}
        value={(draft[field] as string) ?? ""}
        onChange={(e) => set(field, e.target.value as never)}
        placeholder={placeholder}
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Save row shared by every section. */
export function OrgSaveBar({ busy, saved }: { busy: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-3 border-t border-slate-200 pt-5">
      <button type="submit" className="btn-primary px-5 py-2.5" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
      {saved && <span className="text-sm text-emerald-600">Saved.</span>}
    </div>
  );
}
