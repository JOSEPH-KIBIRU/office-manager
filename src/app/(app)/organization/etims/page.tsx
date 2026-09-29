"use client";

import { useState, FormEvent } from "react";
import { PageHeader, Alert } from "@/components/ui";
import OrgSectionNav from "@/components/org/OrgSectionNav";
import { useOrgSettings, OrgField, OrgSaveBar } from "@/components/org/useOrgSettings";

const ETIMS_FIELDS = [
  "etimsEnabled", "etimsEnv", "etimsBaseUrl", "etimsTin", "etimsBhfId",
  "etimsDeviceSerial", "etimsApiKey", "etimsApiSecret",
] as const;

export default function EtimsPage() {
  const { org, draft, set, save, loading, busy, saved, error } = useOrgSettings();
  const enabled = !!draft.etimsEnabled;
  const hasSecret = !!org?.etimsHasSecret;

  return (
    <div className="space-y-6">
      <PageHeader
        title="eTIMS (KRA)"
        subtitle="Submit invoices to Kenya's electronic Tax Invoice Management System and print the control number and QR code."
      />

      <OrgSectionNav />

      {error && <Alert kind="error">{error}</Alert>}
      {loading && <p className="text-sm text-slate-500">Loading eTIMS settings…</p>}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save(ETIMS_FIELDS, "eTIMS settings");
        }}
        className="card max-w-2xl space-y-5 p-6"
      >
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => set("etimsEnabled", e.target.checked as never)}
            className="h-4 w-4 accent-indigo-600"
          />
          <span className="text-sm text-slate-700">
            <b>eTIMS enabled.</b> Invoices can be submitted to KRA from the invoice screen.
          </span>
        </label>

        {!enabled ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Turn this on to configure the device details below.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Environment</label>
                <select
                  className="input"
                  value={String(draft.etimsEnv)}
                  onChange={(e) => set("etimsEnv", e.target.value as never)}
                >
                  <option value="sandbox">Sandbox (testing)</option>
                  <option value="production">Production (live)</option>
                </select>
              </div>
              <OrgField label="API base URL" field="etimsBaseUrl" draft={draft} set={set} placeholder="e.g. https://etims-api-sbx.kra.go.ke" />
              <OrgField label="KRA PIN (TIN)" field="etimsTin" draft={draft} set={set} placeholder="e.g. P000000000X" />
              <OrgField label="Branch ID (bhfId)" field="etimsBhfId" draft={draft} set={set} placeholder="e.g. 00" />
              <OrgField label="Device serial number" field="etimsDeviceSerial" draft={draft} set={set} placeholder="VSCU / OSCU serial" />
              <OrgField label="API key / CMC key" field="etimsApiKey" draft={draft} set={set} placeholder="Device communication key" />
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">API secret (optional, for request signing)</label>
                <input
                  type="password"
                  className="input"
                  value={String(draft.etimsApiSecret)}
                  onChange={(e) => set("etimsApiSecret", e.target.value as never)}
                  placeholder={hasSecret ? "•••••• (saved — leave blank to keep)" : "Optional signing secret"}
                />
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Invoices are submitted when you press “Submit to eTIMS” on the invoice. Failures never block
              invoicing — you can retry.
            </p>
          </>
        )}

        <OrgSaveBar busy={busy} saved={saved} />
      </form>
    </div>
  );
}
