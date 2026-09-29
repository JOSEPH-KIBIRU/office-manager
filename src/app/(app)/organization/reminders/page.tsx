"use client";

import { useState, FormEvent } from "react";
import { PageHeader, Alert } from "@/components/ui";
import OrgSectionNav from "@/components/org/OrgSectionNav";
import { useOrgSettings, OrgNumberField, OrgSaveBar } from "@/components/org/useOrgSettings";

const REMINDER_FIELDS = ["remindersEnabled", "reminderIntervalDays", "reminderMax"] as const;

export default function RemindersPage() {
  const { draft, set, setNumber, save, loading, busy, saved, error } = useOrgSettings();
  const enabled = !!draft.remindersEnabled;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment reminders"
        subtitle="Automatically remind customers when an invoice is overdue."
      />

      <OrgSectionNav />

      {error && <Alert kind="error">{error}</Alert>}
      {loading && <p className="text-sm text-slate-500">Loading reminder settings…</p>}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save(REMINDER_FIELDS, "Payment reminders");
        }}
        className="card max-w-2xl space-y-5 p-6"
      >
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => set("remindersEnabled", e.target.checked as never)}
            className="h-4 w-4 accent-indigo-600"
          />
          <span className="text-sm text-slate-700">
            <b>Automatic reminders on.</b> Customers are texted/emailed when an invoice is overdue.
          </span>
        </label>

        {enabled && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OrgNumberField
              label="Send every (days)"
              field="reminderIntervalDays"
              draft={draft}
              setNumber={setNumber}
              min={1}
              max={60}
              hint="How long an invoice must be overdue before the first reminder."
            />
            <OrgNumberField
              label="Maximum reminders per invoice"
              field="reminderMax"
              draft={draft}
              setNumber={setNumber}
              min={1}
              max={20}
              hint="Stops after this many reminders so customers are not spammed."
            />
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <p className="mb-1 font-semibold text-slate-700">How reminders work</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>Uses the <b>payment instructions</b> from the Invoicing tab, with the invoice total and a reference to the invoice number.</li>
            <li>Runs automatically once a day for unpaid invoices.</li>
            <li>You can also send reminders on demand from the Invoicing page.</li>
          </ul>
        </div>

        <OrgSaveBar busy={busy} saved={saved} />
      </form>
    </div>
  );
}
