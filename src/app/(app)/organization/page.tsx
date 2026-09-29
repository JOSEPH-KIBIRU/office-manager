"use client";

import { useRef, useState, FormEvent } from "react";
import { PageHeader, Alert, FieldError, inputCls, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { ApiOrg } from "@/components/OrgBranding";
import OrgSectionNav from "@/components/org/OrgSectionNav";
import { useOrgSettings, OrgField, OrgSaveBar } from "@/components/org/useOrgSettings";

const BRANDING_FIELDS = ["name", "address", "city", "phone", "email", "taxNumber", "website"] as const;

export default function OrganizationPage() {
  const { org, draft, set, save, loading, busy, saved, error } = useOrgSettings();
  const [logoBusy, setLogoBusy] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!String(draft.name).trim()) {
      setNameError("Company name is required");
      return;
    }
    setNameError(undefined);
    await save(BRANDING_FIELDS, "Company details");
  }

  async function uploadLogo(file: File) {
    setLogoBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<{ storageId: string }>("/api/organization/logo", {
        method: "POST",
        body: form,
      });
      const updated = await api<ApiOrg>("/api/organization", {
        method: "PATCH",
        json: { logoFileId: res.storageId },
      });
      setLogoUrl(updated.logoUrl || null);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setLogoBusy(false);
    }
  }

  async function removeLogo() {
    setLogoBusy(true);
    try {
      const updated = await api<ApiOrg>("/api/organization", {
        method: "PATCH",
        json: { logoFileId: null },
      });
      setLogoUrl(updated.logoUrl || null);
      toast.success("Logo removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove logo");
    } finally {
      setLogoBusy(false);
    }
  }

  const currentLogo = logoUrl !== null ? logoUrl : org?.logoUrl || null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branding & Company"
        subtitle="Company details shown on payslips, invoices, reports and PDF exports."
      />

      <OrgSectionNav />

      {error && <Alert kind="error">{error}</Alert>}
      {loading && !org && <p className="text-sm text-slate-500">Loading company details…</p>}

      <form onSubmit={onSave} className="card max-w-2xl space-y-5 p-6">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Company logo</h3>
          <p className="mb-3 text-xs text-slate-500">
            Appears on the sidebar and at the top of printable documents. PNG, JPG, SVG or WEBP up to 5MB.
          </p>
          <div className="flex items-center gap-4">
            {currentLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentLogo} alt="Company logo" className="h-16 w-16 rounded-lg border border-slate-200 object-contain" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-950 text-2xl font-black text-white">
                {(String(draft.name) || org?.name || "C").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                }}
              />
              <button
                type="button"
                className="btn-secondary px-3 py-2 text-xs"
                disabled={logoBusy}
                onClick={() => fileRef.current?.click()}
              >
                {logoBusy ? "Uploading…" : "Upload logo"}
              </button>
              {currentLogo && (
                <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={removeLogo}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Company name *</label>
          <input
            className={inputCls(nameError)}
            value={String(draft.name)}
            onChange={(e) => {
              set("name", e.target.value);
              setNameError(undefined);
            }}
            placeholder="e.g. Acme Enterprises Ltd"
          />
          <FieldError msg={nameError} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OrgField label="Street address" field="address" draft={draft} set={set} placeholder="e.g. 8th Floor, Koinange St" />
          <OrgField label="City" field="city" draft={draft} set={set} placeholder="e.g. Nairobi" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OrgField label="Phone" field="phone" draft={draft} set={set} placeholder="e.g. +254 712 345 678" />
          <OrgField label="Email" field="email" draft={draft} set={set} type="email" placeholder="e.g. info@acme.co.ke" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OrgField
            label="KRA PIN (Tax) — internal documents only"
            field="taxNumber"
            draft={draft}
            set={set}
            placeholder="e.g. P000000000X"
            hint="Only shown on internal payslips, P9 and reports. Never on invoices sent to customers."
          />
          <OrgField label="Website" field="website" draft={draft} set={set} placeholder="e.g. https://acme.co.ke" />
        </div>

        <OrgSaveBar busy={busy} saved={saved} />

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <p className="mb-1 font-semibold text-slate-700">Where these details appear</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>Company name, logo, address and contact details on <b>payslips</b>, <b>invoices</b>, <b>reports</b> and <b>PDF exports</b>.</li>
            <li>The KRA PIN is only printed on internal documents (payslips, P9, reports) and is <b>never</b> shown on invoices or public pages.</li>
          </ul>
        </div>
      </form>
    </div>
  );
}
