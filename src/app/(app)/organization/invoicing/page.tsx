"use client";

import { useState, FormEvent } from "react";
import { PageHeader, Alert } from "@/components/ui";
import OrgSectionNav from "@/components/org/OrgSectionNav";
import { useOrgSettings, OrgTextarea, OrgSaveBar } from "@/components/org/useOrgSettings";

const INVOICING_FIELDS = ["paymentDetails", "invoiceNotes", "invoiceTerms"] as const;

export default function InvoicingPage() {
  const { draft, set, save, loading, busy, saved, error } = useOrgSettings();
  const [preview, setPreview] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoicing"
        subtitle="Defaults applied to every new invoice. A specific invoice can still override any of these."
      />

      <OrgSectionNav />

      {error && <Alert kind="error">{error}</Alert>}
      {loading && <p className="text-sm text-slate-500">Loading invoice defaults…</p>}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save(INVOICING_FIELDS, "Invoice defaults");
        }}
        className="card max-w-2xl space-y-5 p-6"
      >
        <div className="space-y-4">
          <OrgTextarea
            label="Payment instructions"
            field="paymentDetails"
            draft={draft}
            set={set}
            rows={4}
            placeholder={"Pay to: Acme Enterprises Ltd\nBank: Equity Bank · A/C 0123456789\nM-Pesa Paybill 123456 · Acc: invoice no."}
            hint="Also used as the body of automatic payment reminders."
          />
          <OrgTextarea
            label="Default invoice notes"
            field="invoiceNotes"
            draft={draft}
            set={set}
            rows={2}
            placeholder="e.g. Thank you for your business."
          />
          <OrgTextarea
            label="Terms & conditions"
            field="invoiceTerms"
            draft={draft}
            set={set}
            rows={4}
            placeholder={"Payment due within 30 days.\nLate payments may attract interest.\nGoods remain the property of the company until paid in full."}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="text-sm font-semibold text-slate-700"
            aria-expanded={preview}
          >
            {preview ? "Hide preview" : "Preview on an invoice"}
          </button>
          {preview && (
            <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment instructions</p>
                <p className="whitespace-pre-line text-slate-700">{String(draft.paymentDetails) || "—"}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                <p className="whitespace-pre-line text-slate-700">{String(draft.invoiceNotes) || "—"}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Terms &amp; conditions</p>
                <p className="whitespace-pre-line text-slate-700">{String(draft.invoiceTerms) || "—"}</p>
              </div>
            </div>
          )}
        </div>

        <OrgSaveBar busy={busy} saved={saved} />
      </form>
    </div>
  );
}
