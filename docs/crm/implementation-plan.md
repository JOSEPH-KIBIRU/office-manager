# CRM Implementation Plan

Ordered tasks with dependencies and acceptance criteria. Each task is intentionally
small and independently shippable behind the `crm` feature flag.

**Guardrail:** do not begin Phase 1 schema work until this plan and
`docs/crm/data-model.md` are approved, because it modifies `convex/schema.ts`.

## Progress

| Task | Status |
|---|---|
| T0.1 Test harness (Vitest + convex-test) | ✅ done |
| T0.2 CRM permission keys | ✅ done |
| T1.1 CRM schema + backup registration | ✅ done |
| T1.2 Guarded CRM Convex modules | ✅ done |
| T1.3 Tenant-isolation tests | ✅ done (10 tests) |
| T1.4 Next API routes | ✅ done |
| T2.1 CRM nav + layout + overview | ✅ done |
| T2.2 Companies & contacts UI + AccountingPort | ✅ done |
| T3.1 Pipeline/stage management UI | ⏳ next |
| T3.2 Leads · T3.3 Deals board | ⏳ pending |
| T5 quotations · T6/T7 email | ⏳ pending |

---

## Phase 0 — Foundations (no schema changes)

### T0.1 Test harness
- **Description:** Add Vitest + `convex-test` (and optionally Playwright) and a
  `test` script. No tests exist today (`package.json`).
- **Files:** `package.json`, `vitest.config.ts`, `convex-test` setup, `tests/`.
- **Acceptance:** `npm test` runs; one trivial passing test; CI/script documented.
- **Depends on:** —

### T0.2 CRM permission keys
- **Description:** Add CRM module keys to the shared permission registry and
  role defaults; ensure the platform cap can grant CRM-only.
- **Files:** `src/lib/permissions.ts` (add `crm`, `crm-companies`, `crm-leads`,
  `crm-pipeline`, `crm-quotations`, `crm-email`), `convex/migration.ts` (add keys
  to capped orgs), `.env.example` (no change yet).
- **Acceptance:** keys appear in Permissions/Modules pages; `requirePermission`
  recognises them; `ACCOUNTING`-style bundle constant or CRM bundle exported;
  `tsc` + `build` pass.
- **Depends on:** —

### T0.3 AccountingPort interface (no implementation of CRM yet)
- **Description:** Define the explicit interface between CRM and accounting, with
  a thin implementation that only calls existing Convex functions.
- **Files:** `src/lib/crm/accounting.ts` (interface + impl), unit tests with a
  mocked Convex client.
- **Acceptance:** `ensureCustomerFromCompany`, `createInvoiceFromQuotation`,
  `getInvoiceStatus`, `getCustomerReceivables` defined; no direct journal access;
  tests assert the correct Convex function names are called.
- **Depends on:** T0.1.

### T0.4 Email provider interface skeleton
- **Description:** Port the calendar provider pattern for email; implement the
  interface types and a no-op/disabled provider; reuse token crypto and OAuth state.
- **Files:** `src/lib/email/providers.ts`, `src/lib/email/crypto.ts` (re-export),
  `src/lib/email/state.ts`, `src/lib/email/urls.ts`.
- **Acceptance:** `getEmailProvider("gmail"|"outlook")` returns a descriptor;
  `configured` is false without env vars; crypto round-trip test passes.
- **Depends on:** T0.1.

---

## Phase 1 — Data model & tenant isolation

### T1.1 Schema: CRM tables + indexes
- **Description:** Add the tables from `data-model.md` to `convex/schema.ts` and
  register them for backup/purge.
- **Files:** `convex/schema.ts`, `convex/orgData.ts` (`ORG_TABLES`).
- **Acceptance:** `npx convex codegen` + `tsc` + `build` pass; schema validates on
  `convex deploy` (dev first); no existing table modified.
- **Depends on:** T0.2, approval of data model.

### T1.2 CRM Convex modules + guards
- **Description:** Implement CRUD for companies/contacts/leads/pipelines/stages/
  deals/quotation headers/items/tasks/activities with `assertSecret`,
  `requireOrg`/`requireMember`, org checks on every by-id access, and cross-org
  reference validation.
- **Files:** `convex/crmCompanies.ts`, `crmContacts.ts`, `crmPipelines.ts`,
  `crmLeads.ts`, `crmDeals.ts`, `crmActivities.ts`, `crmTasks.ts`,
  `crmQuotations.ts`.
- **Acceptance:** every function rejects a wrong `orgId`; create/list/get/update/
  delete work for a member; no function returns another tenant's row.
- **Depends on:** T1.1.

### T1.3 Tenant-isolation tests
- **Description:** Automated tests that create two orgs and prove isolation.
- **Files:** `tests/crm/tenant-isolation.test.ts` using `convex-test`.
- **Acceptance:** for each CRM table, a query/mutation with the wrong `orgId`
  throws or returns null; cross-org foreign keys are rejected; listing org A
  never includes org B rows.
- **Depends on:** T1.2.

### T1.4 Next API routes for CRM core
- **Description:** Thin route handlers authenticated with `requirePermission`
  and `recordAudit`, mirroring `src/app/api/invoices|contacts`.
- **Files:** `src/app/api/crm/companies/route.ts`, `…/[id]/route.ts`,
  `…/contacts/…`, `…/leads/…`, `…/pipelines/…`, `…/deals/…`.
- **Acceptance:** unauthorised roles get 403; platform cap respected; audit rows
  written; tenant `orgId` always taken from the session (never the body).
- **Depends on:** T1.2.

---

## Phase 2 — Companies & contacts UI

### T2.1 CRM nav + layout
- **Description:** Add a "CRM" sidebar group/route group gated by `crm`.
- **Files:** `src/components/Sidebar.tsx`, `src/app/(app)/crm/layout.tsx`.
- **Acceptance:** nav hidden without `crm`; account with CRM-only cap sees only CRM.
- **Depends on:** T0.2, T1.4.

### T2.2 Companies & contacts pages
- **Description:** Searchable list/detail with create/edit, link contacts to
  companies, and "promote to accounting customer" via `AccountingPort`.
- **Files:** `src/app/(app)/crm/companies/page.tsx`, `…/[id]/page.tsx`,
  `src/app/(app)/crm/contacts/…`, `src/lib/crm/accounting.ts`.
- **Acceptance:** CRUD works; promoting creates/reuses a `contacts` row and stores
  `accountingContactId`; idempotent on re-promote; perms + empty/loading states.
- **Depends on:** T2.1, T0.3.

---

## Phase 3 — Leads, pipelines, deals

### T3.1 Pipeline/stage management
- **Acceptance:** create pipeline, reorder stages, one default, won/lost stages;
  guarded and audited. **Depends on:** T1.4.
### T3.2 Leads
- **Acceptance:** create/qualify/disqualify, convert lead → company + contact +
  deal in one mutation, set `converted*` links + activity. **Depends on:** T3.1.
### T3.3 Deals board
- **Acceptance:** kanban by stage; drag/drop updates `stageId` and writes a
  `stage_change` activity; won/lost closes the deal. **Depends on:** T3.1.

---

## Phase 4 — Activities & follow-up tasks

### T4.1 Timeline
- **Acceptance:** company/contact/lead/deal show a chronological timeline from
  `crmActivities`; manual note/call/meeting entries; org-scoped. **Depends on:** T1.2.
### T4.2 Follow-up tasks
- **Acceptance:** create/assign/complete tasks linked to CRM entities; due-date
  filters; optional notification. **Depends on:** T1.2, `convex/notifications.ts`.

---

## Phase 5 — Quotations & accounting integration

### T5.1 Quotations CRUD + items
- **Acceptance:** `QUO-0001` numbering via `nextSeq`; totals computed server-side;
  status transitions; items table. **Depends on:** T1.2.
### T5.2 Convert to invoice
- **Acceptance:** accepted quotation → `AccountingPort.createInvoiceFromQuotation`
  creates an invoice (draft or sent per rule), stores `invoiceId`, marks quotation
  `converted`; repeated conversion is idempotent; invoice remains authoritative for
  payment status. **Depends on:** T5.1, T0.3.
### T5.3 Financial status display
- **Acceptance:** deal/company shows invoice + balance from `getInvoiceStatus`/
  `getCustomerReceivables`; read-only; no duplicate financial rows. **Depends on:** T5.2.

---

## Phase 6 — Gmail integration

### T6.1 Gmail provider + OAuth
- **Acceptance:** connect/callback/disconnect; tokens encrypted; `getIdentity`
  returns the mailbox; state verified; no tokens in responses. **Depends on:** T0.4, T1.1.
### T6.2 Gmail sync (read)
- **Acceptance:** pull messages, upsert idempotently, store cursor in
  `crmEmailSyncState`, link to contacts by email; retries/backoff; runner endpoint
  with shared secret. **Depends on:** T6.1.
### T6.3 Gmail UI
- **Acceptance:** connect button on profile/settings; per-connection status; emails
  appear on the timeline. **Depends on:** T6.2, T4.1.

---

## Phase 7 — Outlook integration

### T7.1 Microsoft Graph provider + OAuth
- **Acceptance:** same as T6.1 via Microsoft identity platform; admin-consent path
  documented. **Depends on:** T0.4, T1.1.
### T7.2 Graph sync (read) + UI
- **Acceptance:** delta query + cursor; idempotent upsert; status UI. **Depends on:** T7.1, T6.3.

---

## Phase 8 — Tests & controlled pilot

### T8.1 Automated test suite
- **Acceptance:** tenant-isolation (T1.3) for all CRM tables; permission tests
  (cap + grants); AccountingPort contract tests; provider adapter unit tests with
  mocked HTTP; OAuth state/crypto tests; `npm test` green.
### T8.2 Controlled pilot
- **Acceptance:** CRM keys enabled for **one** pilot org; usage monitored
  (errors/Sentry, audit); documented rollout + rollback (disable `crm` in
  `enabledModules`); feedback captured before wider rollout.

---

## Test plan detail (tenant isolation is mandatory)

1. **Harness:** Vitest + `convex-test`; each test creates `orgA`, `orgB`, users in
   each, and runs functions through the Convex test backend.
2. **Positive:** member of `orgA` can CRUD `orgA` rows.
3. **Negative cross-tenant:**
   - `get`/`update`/`delete` an `orgB` id with `orgId: orgA` → throws.
   - `list` for `orgA` never returns `orgB` rows.
   - Linking a foreign `companyId`/`contactId`/`dealId`/`quotationId` → throws.
   - Email sync upsert cannot write a message into another org's connection.
4. **Permission:** a role without `crm-…` gets 403 at the API layer; a disabled
   platform cap masks CRM everywhere.
5. **Token secrecy:** no query returns `accessTokenEnc`/`refreshTokenEnc`.

---

## Recommended first implementation task

**T0.1 + T0.2 (Foundation): add the test harness and the CRM permission keys.**

Why this first:
- It touches no schema and no production data.
- It lets every later task ship behind a flag.
- It establishes the test harness required by T1.3 (tenant isolation) before any
  CRM data exists.

Immediately after approval, the first *data* task is **T1.1/T1.2/T1.3** (schema +
guarded functions + tenant-isolation tests), which requires explicit approval to
modify `convex/schema.ts`.
