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
  consultations. Age can be entered directly when the date of birth is unknown;
  when a date of birth is supplied, age is calculated automatically and keeps
  increasing over time.
- **Reports** — patient register, consultation register and a per-patient
  statement/history. Every report can be filtered, exported to CSV/Excel and
  printed or saved as PDF.
- Search, payment-status, payment-method, gender and balance filters, plus CSV
  export on both tabs.

## Importing existing Excel records

Open **Patient Consultations → Import Excel**. Three layouts are supported:

| Layout | Use it when |
| --- | --- |
| **Patients only** | The sheet is one row per patient. |
| **Consultations only** | The patients already exist; the sheet is one row per visit. |
| **Patients + consultations** | The sheet is one row per visit and contains the patient details (repeated or only on the first row). |

Each layout has a **Download template** button that generates a real `.xlsx`
file with the expected headings, a sample row and an instructions sheet.

Import rules:

- Accepted files: `.xlsx`, `.xlsm`, `.csv` (legacy `.xls` must be saved as `.xlsx`).
- Maximum 5,000 data rows per file; 20MB upload limit.
- Dates: `YYYY-MM-DD` or `DD/MM/YYYY` (Excel date cells are also supported).
- Age: optional when the date of birth is unknown; date of birth wins if both
  are supplied.
- Gender: `male` or `female`.
- Payment method: cash, M-Pesa, card, bank transfer, insurance or other.
- Payment status: paid or unpaid (default paid).
- Duplicate patients are matched by **patient number**, then **phone**, then
  **full name** and skipped instead of duplicated.
- In a combined sheet, patient details can be left blank on later rows — the
  previous patient is carried forward (handles merged cells).
- Imports are previewed first: the page shows how many patients/visits were
  detected, sample rows and any row-level errors before you commit.
- Large consultation imports are committed in slices so the request does not
  time out. Every imported visit posts to the accounting ledger exactly like a
  manually captured visit.
- Patients with invalid visit rows are still created; the bad visit rows are
  reported so they can be corrected and re-imported.

## Reports

The **Reports** tab offers:

- **Patient register** — every patient with visits, billed, collected and
  outstanding totals.
- **Consultation register** — visits filtered by date, payment status, payment
  method and search.
- **Patient statement (history)** — one patient's details, full visit history
  and balances.

Reports use the organisation header/footer and can be printed or saved as PDF,
exported to CSV, or exported to Excel (`.xls`).

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
