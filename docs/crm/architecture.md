# CRM Architecture — Audit & Proposed Design

Status: **design / awaiting approval**. No schema or production changes have been made.

Scope: a reusable, multi-tenant CRM integrated into Office Manager first, and
capable of serving standalone CRM customers later.

---

## 1. Current architecture findings

### 1.1 Frontend framework, routing, components, auth

| Concern | Finding |
|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + Tailwind CSS v4** (`package.json`). |
| Rendering | Pages under `src/app` are overwhelmingly `"use client"` and fetch data through Next route handlers via `api()` (`src/components/ui.tsx`); a few are server components (layouts). |
| Authenticated app | `src/app/(app)/**` — company workspace. Layout gates on session and redirects super-admins to the console (`src/app/(app)/layout.tsx:13-18`). |
| Platform console | `src/app/(admin)/admin/**` — super-admin only (`src/app/(admin)/layout.tsx`). |
| REST layer | `src/app/api/**` route handlers; standard helpers `handle`, `ok`, `fail`, `readJson`, `requireFields`, `validDate`, `amountInRange` (`src/lib/api.ts`). |
| Components | Shared UI in `src/components/ui.tsx` (`PageHeader`, `Modal`, `Alert`, `ConfirmDialog`, `StatusBadge`, `FieldError`, `inputCls`, `api`). Utility classes (`card`, `btn-primary`, `input`, `table-base`, `badge`). Context providers: `SessionProvider`, `ToastProvider`. |
| Auth | JWT (jose) in an **httpOnly, sameSite=lax, host-only** cookie. `createSessionToken`/`getSession`/`requireUser` in `src/lib/auth.ts`; cookie naming/secure policy in `src/lib/sessionCookie.ts`; `bcryptjs` for password hashes; 2FA challenge tokens in `src/lib/auth.ts:135-151`. |
| Request gating | `src/middleware.ts` verifies the JWT, enforces password-change and Terms acceptance, applies a CSRF/origin guard (`originAllowed`) and per-instance rate limiting. Public APIs: `/api/auth/login`, `/api/enquiries`, `/api/public`, `/api/health`, `/api/cron`. |
| Session shape | `SessionPayload = { id, orgId, name, email, role, mustChangePassword, … }` (`src/lib/types.ts:27-37`). `role` is a free-form string (built-in or company-defined). |

### 1.2 Convex schema, functions, indexes, scheduled jobs, tenant model

- **Backend**: Convex cloud DB + file storage. Schema in `convex/schema.ts` (single file, ~1,256 lines, ~55 tables).
- **Function style**: one flat file per domain (`convex/invoicing.ts`, `convex/leaves.ts`, …). Every function takes an explicit `secret` argument and calls `assertSecret(secret)` (`convex/lib.ts:5-9`).
- **Tenant guards**: `requireOrg(ctx, orgId)` and `requireMember(ctx, orgId, userId)` (`convex/lib.ts:27-54`). Handlers almost always do `doc.orgId !== args.orgId → throw`.
- **Indexes**: 21 `by_org*` indexes declared across the schema; most tenant tables have `by_org` and a compound (`by_org_*`). This is the established pattern the CRM must follow.
- **Scheduled jobs**:
  - Convex crons (`convex/crons.ts`): annual leave reset, monthly subscription check.
  - Vercel crons (`vercel.json`): `/api/cron/invoice-reminders` (06:00), `/api/cron/document-expiry` (07:00), `/api/cron/health-check` (08:00).
  - Reusable queue-runner pattern: `/api/integrations/sync/run` authorised by `CALENDAR_SYNC_SECRET` (`src/app/api/integrations/sync/run/route.ts`).
- **Tenant model**:
  - `organizations` table (`convex/schema.ts:6-66`) is the tenant. A `__platform` org stores platform staff (`convex/seed.ts:28-33`).
  - `users.orgId` binds a user to exactly one tenant; email is globally unique (`by_email`).
  - Every domain record carries `orgId` and is indexed `by_org`.
  - Platform feature cap: `organizations.enabledModules` (null/absent = all) enforced first in `requirePermission` (`src/lib/permissionGuard.ts:64-67`) and persisted by `setEnabledModules` (`convex/permissions.ts:167-202`).
  - Per-role grants: `organizations.rolePermissions`; custom roles: `organizations.customRoles`; resolved by `resolveAccess` (`convex/permissions.ts:36-52`).

### 1.3 Existing company/customer, quotation, invoice, payment, file storage

| Concept | Existing implementation | Notes for CRM |
|---|---|---|
| Company | **No dedicated company entity.** `organizations` is the tenant. The `contacts.company` field is free text. | CRM needs its own company entity (see §3). |
| Customer/contact | `contacts` table (`convex/schema.ts:457-481`), typed `customer` \| `supplier`, with `name`, `legalName`, `contactPerson`, `email`, `phone`, `company`, `address`, `tin`, `paymentTerms`, `creditLimit`, `notes`. CRUD in `convex/invoicing.ts` (`listContacts`/`createContact`/`updateContact`/`deleteContact`). API: `src/app/api/contacts/route.ts`. | Reuse as the **accounting** contact; link from CRM rather than duplicate finance data. |
| Quotation | **None.** No quote/quotation table, function, route, or UI exists (grep across `convex` + `src`). | New CRM entity. |
| Invoice | `invoices` table (`convex/schema.ts:483-537`) with embedded `lineItems[]` (`description, qty, unitPrice, taxRate`), totals, status, eTIMS fields. Created/edited in `convex/invoicing.ts`; **posts to the GL on `sent`/`overdue`** via `tryPostJournalForSource` (`convex/invoicing.ts:434-447`); cancel/void reverses (`:448-460`). | CRM must not create its own financial invoice; convert a quotation by calling this. |
| Payment / settlement | `payments` (receipt/payment) + `allocations` open-item matching (`convex/schema.ts:571-632`); sub-ledger in `convex/subledger.ts` (`createReceipt`, `createPayment`, `aging`, `contactLedger`). Payments are the source of truth for settlement (`convex/invoicing.ts:421-426`). | Read-only status for CRM via an interface. |
| File storage | Convex `_storage` + `storedFiles` registry (`convex/schema.ts:634-641`, `convex/storage.ts:5-70`), org-scoped URL lookup, `/api/files/[name]`, `documents` table (`convex/documents.ts`), UploadThing for task images (`src/app/api/uploadthing`). | Reuse `storedFiles` + `/api/files` for CRM attachments (add a `crm` kind). |

### 1.4 Users, roles, membership, permissions enforcement

1. **Identity**: JWT session (`src/lib/auth.ts`) → API route calls `requireUser()`/`requirePermission()` (`src/lib/permissionGuard.ts`).
2. **Module gate**: `requirePermission(module, fallbackRoles)` checks, in order: authenticated → platform cap (`enabledModules`) → admin bypass → grant-driven for custom/configured roles → legacy role fallback (`src/lib/permissionGuard.ts:53-83`).
3. **Data-layer proof**: Convex re-checks tenant membership with `requireOrg`/`requireMember` even though the Next layer already authenticated (`convex/lib.ts`).
4. **UI**: `usePermissions()` fetches `/api/permissions/mine`; the sidebar is grant-driven (`src/components/Sidebar.tsx:175-187`), so custom roles appear without hardcoding.
5. **Audit**: `recordAudit(session, …)` from the Next layer writes to `auditLogs` (`src/lib/audit.ts`, `convex/schema.ts:1231-1247`).

> **Convention to follow:** authorization lives in the Next API layer; Convex trusts a shared secret + explicit `orgId` but *also* re-validates membership. The CRM must not weaken this.

### 1.5 Deployment, environment variables, tests

- **Hosting**: Vercel (Next.js) + a Convex production deployment; Convex functions are pushed with `npx convex deploy`. `vercel.json` declares the cron routes.
- **Env vars** (`.env.example`): `AUTH_SECRET`, `CONVEX_SERVER_SECRET`, seed admin/super-admin values, `RESEND_API_KEY`, `EMAIL_FROM`, `OPENAI_API_KEY`, `TALKSASA_*`, `UPLOADTHING_TOKEN`, `APP_URL`, `COOKIE_SECURE`, **`GOOGLE_CLIENT_ID/SECRET`**, **`MICROSOFT_CLIENT_ID/SECRET`**, **`TOKEN_ENCRYPTION_KEY`**, **`CALENDAR_SYNC_SECRET`**, Sentry vars.
- **Tests**: **none.** No `test` script, no Vitest/Jest/Playwright config; only `lint` and `build` (`package.json`). This is a gap the CRM plan must close (see `implementation-plan.md`).

### 1.6 Existing features that can be reused (do not duplicate)

- **OAuth provider adapter pattern** — `src/lib/calendar/providers.ts` (interface `CalendarProvider`, Google + Microsoft implementations, `authUrl`/`exchangeCode`/`refresh`/`getEmail`/writes). Mirror it for email.
- **Encrypted token storage** — AES-256-GCM `encryptToken`/`decryptToken` (`src/lib/calendar/crypto.ts`), keyed by `TOKEN_ENCRYPTION_KEY`. Reuse verbatim for Gmail/Graph tokens.
- **OAuth state signing/verification** — `src/lib/calendar/state.ts` (signed JWT, 10-min TTL, binds `userId`/`orgId`/provider). Reuse.
- **Connections + queue + sync pattern** — `calendarConnections` / `calendarEvents` / `calendarSyncJobs` (`convex/schema.ts:1109-1161`), token refresh + job claim/finish (`convex/calendar.ts`, `src/lib/calendar/sync.ts`), background kick-off with `after()` (`src/lib/calendar/enqueue.ts`).
- **Accounting interfaces** — `convex/invoicing.ts` (contacts, invoices), `convex/subledger.ts` (receipts/payments/aging/contact ledger), `convex/accounting.ts` (`postJournalForSource`, `tryPostJournalForSource`, `reverseJournalInternal`, `nextSeq`). Do **not** read journals directly from CRM.
- **Numbering** — monotonic `nextSeq(ctx, orgId, "INV"|"QUO"|…)` via `counters` (`convex/accounting.ts:353`, `convex/schema.ts:1080-1084`).
- **Audit** — `recordAudit` + `auditLogs`.
- **Notifications** — `pushNotification`/`notifyStaff` (`convex/notifications.ts`) and `src/app/api/notifications`.
- **File storage** — `storedFiles` + `convex/storage.ts` + `/api/files`.
- **Backup/purge registry** — `convex/orgData.ts` `ORG_TABLES`; **new CRM tables must be added** so backups and hard-delete include them.
- **Public lead source** — `enquiries` (`convex/enquiries.ts`, `/api/enquiries`) is a public contact form; a future "enquiry → CRM lead" import is trivial.
- **UI primitives** — `src/components/ui.tsx` (Modal/ConfirmDialog/PageHeader/StatusBadge).

---

## 2. Proposed CRM architecture

### 2.1 Layering (keep CRM separate from accounting internals)

```
Browser (Next.js CRM pages, src/app/(app)/crm/**)
        │  fetch
        ▼
Next API routes (auth + permissions)  ──►  provider adapters (Gmail/Graph)   [server-only]
        │  cx().query/mutation                    │
        ▼                                         ▼
Convex CRM functions (orgId-scoped)        Email sync/queue
        │
        ├── CRM data: crmCompanies, crmContacts, crmLeads, crmPipelines, crmStages,
        │             crmDeals, crmActivities, crmTasks, crmQuotations, crmQuotationItems,
        │             crmEmailConnections, crmEmailMessages, crmEmailSyncState
        │
        └── AccountingPort (explicit interface)
                     │  calls existing Convex functions only
                     ▼
            convex/invoicing.ts  ·  convex/subledger.ts  ·  convex/accounting.ts
```

**Explicit interface.** Define `AccountingPort` (implemented in the Next layer, e.g.
`src/lib/crm/accounting.ts`) with only these operations:

- `ensureCustomerForCompany(companyId)` → creates/reuses a `contacts` row of type
  `customer` and stores `crmCompanies.accountingContactId`. Calls
  `api.invoicing.createContact` / `getContact`.
- `createInvoiceFromQuotation(quotationId)` → calls `api.invoicing.createInvoice`
  (+ `setInvoiceStatus("sent")` when appropriate), storing
  `crmQuotations.invoiceId`. Never writes `invoices`/`journals` directly.
- `getInvoiceStatus(invoiceId)` → `api.invoicing.getInvoice`.
- `getCustomerReceivables(contactId)` → `api.subledger.contactLedger` / `aging`.

Rationale: CRM can render financial status without owning it; accounting stays
authoritative and CRM can later point at a different accounting backend.

### 2.2 Multi-tenant + standalone CRM

- **Tenant boundary**: every CRM table carries `orgId` and a `by_org` index;
  every CRM function calls `requireOrg` (or `requireMember`) and checks
  `doc.orgId === args.orgId`.
- **Feature flag**: add CRM module keys to `src/lib/permissions.ts`
  (`crm`, `crm-companies`, `crm-leads`, `crm-pipeline`, `crm-quotations`,
  `crm-email`). The platform cap (`enabledModules`) lets the super-admin give a
  customer CRM only — the same mechanism already used for accounting-only tenants.
- **Standalone CRM (future)**: two viable paths; **recommended: one deployment,
  plan-gated route group**:
  - Add a `src/app/(crm)` route group (or reuse `(app)` with a CRM-only nav) that
    renders when the tenant's `enabledModules` includes CRM keys.
  - A "CRM-only" tenant is an `organizations` row whose `enabledModules` is the
    CRM key set and whose users have `crm*` grants. No second backend, no data
    migration.
  - If a fully separate product surface is later required, the same Convex
    deployment and schema can back a new Next app; **do not introduce another
    backend without a documented justification** (per constraints).
- **Subscription**: existing `subscriptions` table + plan enum
  (`convex/subscriptions.ts`) can gain a CRM add-on later; not in Phase 1 scope.

### 2.3 Email provider abstraction

Mirror the calendar design exactly:

```
src/lib/email/providers.ts
  interface EmailProvider {
    id: "gmail" | "outlook";
    label: string;
    configured: boolean;
    authUrl(redirectUri, state): string;
    exchangeCode(code, redirectUri): Promise<TokenSet>;
    refresh(refreshToken): Promise<TokenSet>;
    getIdentity(accessToken): Promise<{ email: string | null }>;
    listMessages(accessToken, cursor, limit): Promise<{ messages: EmailSummary[]; nextCursor: string | null }>;
    getMessage(accessToken, id): Promise<EmailMessage>;
    sendMessage?(accessToken, draft): Promise<{ id: string }>;   // Phase 2
  }
  getEmailProvider(id)
```

- `src/lib/email/crypto.ts` re-exports the existing calendar crypto (or moves it to
  a shared `src/lib/crypto/tokens.ts` to avoid duplication).
- `src/lib/email/state.ts` reuses the signed-state approach (bind provider + mailbox
  to `userId`/`orgId`).
- `src/lib/email/sync.ts` mirrors `src/lib/calendar/sync.ts`: claim jobs → refresh
  token if needed → fetch delta → upsert `crmEmailMessages` / advance
  `crmEmailSyncState` → finish job with error/backoff.
- Routes: `/api/crm/integrations/[provider]/connect|callback|disconnect`,
  `/api/crm/integrations/sync/run` (shared-secret runner, like
  `src/app/api/integrations/sync/run`).
- Nothing token-related ever leaves the server: queries expose only
  `{ provider, email, status, lastSyncedAt }`.

### 2.4 Security summary

- OAuth 2.0 authorization-code flow with `state` (signed, TTL) and `offline_access`.
- Least-privilege scopes (§ `email-integrations.md`).
- Tokens encrypted at rest with AES-256-GCM (`TOKEN_ENCRYPTION_KEY`); never in
  frontend payloads, logs, or git.
- All CRM mutations audited via `recordAudit`.
- Tenant isolation enforced at the API layer *and* re-checked in Convex.

---

## 3. Existing files/functions to reuse or modify

### Reuse as-is
- `src/lib/calendar/providers.ts`, `crypto.ts`, `state.ts`, `enqueue.ts`, `sync.ts` — template for email.
- `convex/calendar.ts` — template for connection/queue functions.
- `src/lib/api.ts`, `src/lib/auth.ts`, `src/lib/permissionGuard.ts`, `src/lib/convex.ts`, `src/lib/audit.ts`.
- `convex/lib.ts` (`assertSecret`, `requireOrg`, `requireMember`, `orgBranding`).
- `convex/invoicing.ts`, `convex/subledger.ts`, `convex/accounting.ts` — via `AccountingPort` only.
- `convex/storage.ts`, `/api/files/[name]`, `convex/documents.ts`.
- `convex/notifications.ts`, `src/app/api/notifications`.
- `src/components/ui.tsx`, `src/components/Sidebar.tsx`, `usePermissions`.

### Modify
- `convex/schema.ts` — add CRM tables/indexes (approval required).
- `src/lib/permissions.ts` — add CRM module keys + role defaults.
- `convex/orgData.ts` — add CRM tables to `ORG_TABLES` (backup/purge).
- `src/components/Sidebar.tsx` — add a "CRM" nav group.
- `convex/migration.ts` — migration to add CRM keys to capped orgs (if CRM is
  enabled for existing tenants).
- `.env.example` — document any new env vars (reuse existing Google/Microsoft
  client IDs where scopes allow, or add CRM-specific ones).
- `src/middleware.ts` — only if new public endpoints are added (e.g. OAuth
  callback must still require the session; do not make it public).

### New
- `convex/crm/*.ts` (companies, contacts, pipelines, leads, deals, activities,
  tasks, quotations, email connections/messages/sync).
- `src/app/api/crm/**` route handlers.
- `src/app/(app)/crm/**` pages.
- `src/lib/crm/accounting.ts` (AccountingPort), `src/lib/email/**`.
- `docs/crm/*` (this documentation).

---

## 4. Unresolved decisions / blockers

1. **CRM company/contact vs existing `contacts`.** Recommendation: new
   `crmCompanies`/`crmContacts` with `accountingContactId` link. Needs sign-off.
2. **Follow-up tasks: reuse `tasks` or new `crmTasks`?** Recommendation: new
   `crmTasks` (the staff `tasks` workflow has acknowledgement states that don't fit
   sales follow-ups). Needs sign-off.
3. **Email read-only vs send in Phase 1.** Recommendation: read + link only; sending
   is Phase 2 (extra scopes + abuse controls).
4. **Gmail restricted-scope verification** — `gmail.readonly`/`gmail.send` require
   Google OAuth verification (may take weeks). Blocks production Gmail rollout.
5. **Microsoft Graph app registration + publisher verification** and admin consent
   for org mailboxes.
6. **Sync transport**: Gmail `users.watch` + Pub/Sub (needs a public webhook and
   renewal cron) vs polling with `historyId`; Outlook delta query polling. Recommend
   polling first, webhook later.
7. **Email body storage & retention/PII** — cache metadata only vs full bodies.
8. **Currency** — single currency (KES) vs multi-currency quotations/deals.
9. **Data scoping** — org-wide CRM vs owner/team scoping (sales reps see only their
   accounts). Recommend org-wide in Phase 1 with `ownerId` for future scoping.
10. **Tests** — no harness exists; must add one (recommend Vitest + `convex-test`).
11. **Quotation numbering** — `QUO-0001` via `nextSeq`; confirm convention.
12. **Standalone CRM billing** — whether CRM is an add-on to an existing plan or a
    separate subscription SKU.
