# Hospital / patient consultations add-on

The patient register and consultation log from the earlier (Supabase) app have
been ported to the Next.js + Convex architecture. It is an **opt-in module**, so
other companies never see it unless the platform owner enables it for them.

## What was added

| Area | Where |
| --- | --- |
| Sidebar | **Healthcare → Patient Consultations** (`/patients`) |
| Module permission | `patients` in `src/lib/permissions.ts` (group **Healthcare**) |
| Data model | `patients`, `patientConsultations` in `convex/schema.ts` |
| Backend logic | `convex/patients.ts` |
| HTTP API | `/api/patients`, `/api/patients/[id]`, `/api/consultations`, `/api/consultations/[id]` |
| Accounting integration | `consultation` journal source + income account `4200` in `convex/accounting.ts` |
| Backup / restore | `convex/orgData.ts`, `convex/restore.ts` |

## Enabling it

1. **Platform cap** — as the platform owner, open **Admin → Features**, pick the
   hospital company and tick **Patient Consultations**. Companies without an
   explicit cap already have every module available.
2. **Role grants** — sign in as the hospital's admin and open
   **Company → Roles & permissions**. The Director always has access; grant
   **Patient Consultations** to the secretary / manager / custom roles that work
   with patients.
3. The sidebar item appears for granted roles only. Direct API access is also
   blocked for companies/roles that do not have the module.

The UI exposes delete actions to admins and secretaries; every granted role can
register patients and record/edit consultations.

## Accounting linkage

Consultation fees post through the same double-entry engine as invoices, bills
and petty cash. Journals are immutable, so edits and deletions **reverse** the
previous entry and post a corrected one.

| Consultation state | Debit | Credit |
| --- | --- | --- |
| Paid — cash / other | `1000` Cash on hand (or the configured cash control account) | `4200` Consultation income |
| Paid — M-Pesa | `1030` M-Pesa (or the account flagged M-Pesa) | `4200` Consultation income |
| Paid — card / bank transfer / insurance | `1020` Bank (or the configured bank control account) | `4200` Consultation income |
| Unpaid / bill later | `1100` Accounts receivable | `4200` Consultation income |

`4200 Consultation income` is seeded automatically the first time a fee is
posted. Medical services are flagged `exempt` for VAT. Marking an unpaid visit
as paid reverses the receivable entry and posts the cash/bank entry.

Because posting respects accounting periods, a consultation cannot be saved,
edited or deleted in a **locked** period. Closed periods block new postings —
post an adjustment journal or move the visit to an open period instead.

## Screens

- **Consultations** — date, patient, procedure/service, attending doctor, amount,
  payment method, payment status and clinical notes. Pick an existing patient or
  register one inline in the same form.
- **Patients** — patient number (`P-0001`…), name, contact, age/gender, visits,
  total billed and outstanding balance. **History** jumps to that patient's
  consultations.
- Search, payment-status and date-range filters, plus CSV export on both tabs.

## Tests

`tests/hospital.test.ts` covers patient numbering, ledger posting (paid/unpaid),
reverse-and-repost on edit, reversal on delete, inline registration and tenant
isolation.

Run the suite with:

```
npm test
```

After schema changes run `npx convex dev` (or deploy) once so Convex regenerates
`convex/_generated/` and pushes the new tables.
