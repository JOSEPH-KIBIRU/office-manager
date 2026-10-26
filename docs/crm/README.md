# Office Manager CRM — Design Documentation

This folder contains the repository audit and the proposed CRM design. **No code,
schema, or production data has been changed yet** — this is the approval gate.

| Document | Contents |
|---|---|
| [architecture.md](./architecture.md) | Current architecture findings, proposed CRM architecture, reuse list, unresolved decisions/blockers. |
| [data-model.md](./data-model.md) | CRM entities, fields, relationships, indexes, tenant boundaries. |
| [implementation-plan.md](./implementation-plan.md) | Ordered tasks, dependencies, acceptance criteria, test plan, recommended first task. |
| [email-integrations.md](./email-integrations.md) | Gmail + Microsoft Graph OAuth, scopes, sync, retries, production verification. |

## TL;DR of the audit

- Stack: **Next.js 15 App Router + React 19 + Tailwind v4**, custom **JWT cookie**
  auth, **Convex** backend + file storage. No test framework today.
- Tenancy: `organizations` + `users.orgId`; every table carries `orgId` and a
  `by_org` index; access is enforced in the Next API layer and re-checked in
  Convex (`requireOrg`/`requireMember`).
- Accounts/finance already exist: `contacts` (customer/supplier), `invoices`
  (posts to the GL), `payments` + `allocations` + sub-ledger. **No quotations and
  no CRM exist.**
- Reusable now: the calendar OAuth adapter (`src/lib/calendar/*`), AES-256-GCM
  token encryption, signed OAuth state, the sync job queue + runner, file storage,
  notifications, audit, and the permissions/cap system.
- Proposed: new `crm*` tables (companies, contacts, pipelines/stages, leads, deals,
  activities, tasks, quotations/items, email connections/messages/sync-state) linked
  to accounting via an explicit `AccountingPort`; Gmail/Outlook behind one
  `EmailProvider` interface.

## Recommended first implementation task

**T0.1 + T0.2 — add the test harness (Vitest + `convex-test`) and the CRM
permission keys.** No schema changes; ships behind the `crm` feature flag; enables
the mandatory tenant-isolation tests before CRM data exists.

The first data task (requires approval to edit `convex/schema.ts`) is
**T1.1–T1.3**: CRM tables + guarded Convex functions + tenant-isolation tests.
