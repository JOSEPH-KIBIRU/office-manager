# CRM Data Model

Status: **proposed** (awaiting approval). No tables have been added.

This model follows the existing Convex conventions (`convex/schema.ts`): every
tenant-owned table carries `orgId`, declares a `by_org` index, uses numeric epoch
timestamps (`tsNow()`), string-literal status unions, and references other rows by
Convex `Id<"table">` (stable IDs). Human-readable references use the monotonic
`counters` mechanism (`nextSeq`, `convex/accounting.ts:353`).

---

## 1. Tenancy & identity (reuse — no new tables)

| Table | Role in CRM |
|---|---|
| `organizations` | The tenant. `enabledModules` gates the CRM keys; `rolePermissions`/`customRoles` grant them. |
| `users` | Actors/owners/assignees. `orgId` binds membership. |
| `auditLogs` | CRM audit events (reused; `module: "crm"`). No new audit table. |
| `contacts` | **Accounting** customers/suppliers. CRM links to it; never duplicates financial data. |
| `invoices` / `payments` / `allocations` | **Authoritative** financial records. CRM references them read-only. |
| `storedFiles` | Org-scoped attachments (add a `crm` `kind`). |
| `counters` | Quotation numbers (`QUO-0001`). |

> **Rule:** no CRM table may be the source of truth for money owed or received.
> Quotation totals are pre-sales documents; once converted, the invoice/payment
> records in accounting are authoritative.

---

## 2. New entities

### 2.1 `crmCompanies`

A CRM account (the customer/prospect as a business), distinct from the accounting
`contacts` row.

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | tenant |
| `name` | `string` | required |
| `domain` | `string?` | e.g. `acme.co.ke` (used for email matching) |
| `industry` | `string?` | |
| `website` | `string?` | |
| `phone` | `string?` | |
| `address` | `string?` | |
| `city` | `string?` | |
| `country` | `string?` | |
| `notes` | `string?` | |
| `ownerId` | `Id<"users">?` | account owner (future scoping) |
| `accountingContactId` | `Id<"contacts">?` | link to the accounting customer once promoted |
| `source` | `string?` | e.g. `referral`, `enquiry` |
| `active` | `boolean?` | default true |
| `createdBy` | `Id<"users">` | |
| `createdAt` | `number` | |
| `updatedAt` | `number` | |

Indexes:
- `by_org` (`orgId`)
- `by_org_name` (`orgId`, `name`)
- `by_org_owner` (`orgId`, `ownerId`)
- `by_org_accounting_contact` (`orgId`, `accountingContactId`)

### 2.2 `crmContacts`

People at a company (or standalone prospects).

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | tenant |
| `companyId` | `Id<"crmCompanies">?` | nullable (contact may precede company) |
| `name` | `string` | required |
| `title` | `string?` | job title |
| `email` | `string?` | |
| `phone` | `string?` | |
| `linkedin` | `string?` | |
| `notes` | `string?` | |
| `ownerId` | `Id<"users">?` | |
| `accountingContactId` | `Id<"contacts">?` | optional direct link |
| `createdBy` | `Id<"users">` | |
| `createdAt` | `number` | |
| `updatedAt` | `number` | |

Indexes: `by_org`, `by_org_company` (`orgId`, `companyId`),
`by_org_email` (`orgId`, `email`).

### 2.3 `crmPipelines`

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `name` | `string` | e.g. "Sales", "Enterprise" |
| `isDefault` | `boolean` | one default per org |
| `active` | `boolean` | |
| `createdAt` / `updatedAt` | `number` | |

Indexes: `by_org`, `by_org_active` (`orgId`, `active`).

### 2.4 `crmStages`

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `pipelineId` | `Id<"crmPipelines">` | |
| `name` | `string` | e.g. "Qualified" |
| `order` | `number` | display/sequence |
| `probability` | `number?` | 0–100 (for forecasts) |
| `isWon` / `isLost` | `boolean` | terminal stages |
| `createdAt` | `number` | |

Indexes: `by_org`, `by_pipeline` (`pipelineId`),
`by_org_pipeline` (`orgId`, `pipelineId`).

### 2.5 `crmLeads`

Unqualified inbound prospects, convertible to a company/contact/deal.

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `companyName` | `string?` | free text before a company exists |
| `contactName` | `string?` | |
| `email` | `string?` | |
| `phone` | `string?` | |
| `source` | `string?` | `enquiry`, `referral`, `web`, … |
| `status` | literal | `new` \| `contacted` \| `qualified` \| `disqualified` \| `converted` |
| `ownerId` | `Id<"users">?` | |
| `value` | `number?` | estimated |
| `notes` | `string?` | |
| `convertedCompanyId` | `Id<"crmCompanies">?` | set on conversion |
| `convertedContactId` | `Id<"crmContacts">?` | |
| `convertedDealId` | `Id<"crmDeals">?` | |
| `createdBy` | `Id<"users">` | |
| `createdAt` / `updatedAt` | `number` | |

Indexes: `by_org`, `by_org_status` (`orgId`, `status`),
`by_org_owner` (`orgId`, `ownerId`), `by_org_email` (`orgId`, `email`).

> Conversion is transactional: create company/contact/deal, set `status:
> "converted"` and the `converted*` links, and write an activity.

### 2.6 `crmDeals`

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `pipelineId` | `Id<"crmPipelines">` | |
| `stageId` | `Id<"crmStages">` | |
| `companyId` | `Id<"crmCompanies">?` | |
| `contactId` | `Id<"crmContacts">?` | |
| `leadId` | `Id<"crmLeads">?` | provenance |
| `title` | `string` | |
| `value` | `number` | |
| `currency` | `string` | default `"KES"` |
| `expectedCloseDate` | `string?` | `YYYY-MM-DD` |
| `ownerId` | `Id<"users">?` | |
| `status` | literal | `open` \| `won` \| `lost` |
| `lostReason` | `string?` | |
| `closedAt` | `number?` | |
| `notes` | `string?` | |
| `createdBy` | `Id<"users">` | |
| `createdAt` / `updatedAt` | `number` | |

Indexes: `by_org`, `by_org_pipeline` (`orgId`, `pipelineId`),
`by_org_stage` (`orgId`, `stageId`), `by_org_company` (`orgId`, `companyId`),
`by_org_owner` (`orgId`, `ownerId`), `by_org_status` (`orgId`, `status`).

### 2.7 `crmActivities` (customer timeline)

Polymorphic timeline events attached to a company/contact/lead/deal/quotation.

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `entityType` | literal | `company` \| `contact` \| `lead` \| `deal` \| `quotation` |
| `entityId` | `string` | Convex id as string (polymorphic) |
| `type` | literal | `note` \| `call` \| `email` \| `meeting` \| `stage_change` \| `task` \| `quotation` |
| `subject` | `string?` | |
| `body` | `string?` | |
| `occurredAt` | `number` | |
| `actorId` | `Id<"users">?` | |
| `metadata` | `any?` | e.g. `{ fromStageId, toStageId }` |
| `createdAt` | `number` | |

Indexes: `by_org`, `by_entity` (`entityType`, `entityId`),
`by_org_entity` (`orgId`, `entityType`, `entityId`),
`by_org_occurred` (`orgId`, `occurredAt`).

### 2.8 `crmTasks` (follow-ups)

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `title` | `string` | |
| `description` | `string?` | |
| `dueAt` | `number?` | |
| `status` | literal | `open` \| `done` \| `cancelled` |
| `priority` | literal? | `low` \| `normal` \| `high` \| `urgent` |
| `assigneeId` | `Id<"users">?` | |
| `companyId` / `contactId` / `leadId` / `dealId` | refs | at most one primary target |
| `completedAt` | `number?` | |
| `createdBy` | `Id<"users">` | |
| `createdAt` / `updatedAt` | `number` | |

Indexes: `by_org`, `by_org_assignee` (`orgId`, `assigneeId`),
`by_org_status` (`orgId`, `status`), `by_org_due` (`orgId`, `dueAt`),
`by_org_deal` (`orgId`, `dealId`).

> Decision: **new table**, not the staff `tasks` table. The staff workflow
> (`submitted`/`acknowledged`/`reopened`) is incompatible with sales follow-ups.
> See "Unresolved decisions".

### 2.9 `crmQuotations`

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `number` | `string` | `QUO-0001` via `nextSeq` |
| `companyId` | `Id<"crmCompanies">?` | |
| `contactId` | `Id<"crmContacts">?` | |
| `dealId` | `Id<"crmDeals">?` | |
| `status` | literal | `draft` \| `sent` \| `accepted` \| `rejected` \| `expired` \| `converted` |
| `issueDate` | `string` | `YYYY-MM-DD` |
| `validUntil` | `string?` | |
| `currency` | `string` | default `"KES"` |
| `notes` / `terms` | `string?` | |
| `subtotal` / `taxTotal` / `total` | `number` | derived from items |
| `invoiceId` | `Id<"invoices">?` | set when converted to an accounting invoice |
| `sentAt` / `acceptedAt` | `number?` | |
| `createdBy` | `Id<"users">` | |
| `createdAt` / `updatedAt` | `number` | |

Indexes: `by_org`, `by_org_company` (`orgId`, `companyId`),
`by_org_deal` (`orgId`, `dealId`), `by_org_status` (`orgId`, `status`).

### 2.10 `crmQuotationItems`

Separate table (per the brief) rather than embedded `lineItems`.

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `quotationId` | `Id<"crmQuotations">` | |
| `description` | `string` | |
| `qty` | `number` | |
| `unitPrice` | `number` | |
| `taxRate` | `number` | percent |
| `order` | `number` | line sequence |
| `createdAt` | `number` | |

Indexes: `by_org`, `by_quotation` (`quotationId`).

> Note: invoices embed `lineItems` (existing convention). Quotations use a table
> so items can be edited/queried independently before conversion.

### 2.11 `crmEmailConnections`

Encrypted OAuth credentials, one per user per provider (mirrors
`calendarConnections`).

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `userId` | `Id<"users">` | |
| `provider` | literal | `gmail` \| `outlook` |
| `email` | `string?` | mailbox identity |
| `accessTokenEnc` | `string` | **AES-256-GCM ciphertext** |
| `refreshTokenEnc` | `string?` | ciphertext |
| `expiresAt` | `number` | |
| `scope` | `string?` | granted scopes |
| `status` | literal | `active` \| `error` |
| `lastError` | `string?` | |
| `createdAt` / `updatedAt` | `number` | |

Indexes: `by_user`, `by_org`, `by_user_provider` (`userId`, `provider`).

> Naming uses `…Enc` to make it obvious these are ciphertext. Queries must strip
> token fields before returning to callers (as `listMyConnections` does today).

### 2.12 `crmEmailMessages`

Cached message metadata linked to CRM entities (not full mail bodies by default).

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `connectionId` | `Id<"crmEmailConnections">` | |
| `provider` | literal | `gmail` \| `outlook` |
| `providerMessageId` | `string` | idempotency key |
| `threadId` | `string?` | conversation grouping |
| `internetMessageId` | `string?` | RFC 5322 `Message-ID` for threading |
| `direction` | literal | `inbound` \| `outbound` |
| `from` | `string` | |
| `to` | `string[]` | |
| `cc` | `string[]?` | |
| `subject` | `string?` | |
| `snippet` | `string?` | short preview |
| `receivedAt` | `number` | |
| `hasAttachments` | `boolean?` | |
| `ignored` | `boolean?` | hidden from the inbox "needs attention" list |
| `companyId` / `contactId` / `leadId` / `dealId` / `quotationId` | refs | links |
| `createdAt` | `number` | |

Indexes: `by_org`, `by_connection` (`connectionId`),
`by_org_provider_message` (`orgId`, `provider`, `providerMessageId`),
`by_org_company` (`orgId`, `companyId`), `by_org_contact` (`orgId`, `contactId`),
`by_org_deal` (`orgId`, `dealId`).

Idempotency: upsert on `(orgId, provider, providerMessageId)`.

### 2.13 `crmEmailSyncState`

Per-connection cursor and sync health.

| Field | Type | Notes |
|---|---|---|
| `orgId` | `Id<"organizations">` | |
| `connectionId` | `Id<"crmEmailConnections">` | |
| `provider` | literal | |
| `cursor` | `string?` | Gmail `historyId` / Graph `deltaLink` |
| `lastSyncedAt` | `number?` | |
| `status` | literal | `idle` \| `syncing` \| `error` |
| `error` | `string?` | |
| `updatedAt` | `number` | |

Indexes: `by_org`, `by_connection` (`connectionId`).

### 2.14 Audit events

Reuse `auditLogs` (`convex/schema.ts:1231-1247`) with `module: "crm"` and
`targetType`/`targetId` (e.g. `deal`, `quotation`, `email_connection`). No new table.

---

## 3. Relationships

```
organizations 1─* users
organizations 1─* crmCompanies
organizations 1─* crmPipelines 1─* crmStages
organizations 1─* crmLeads
organizations 1─* crmDeals *─1 crmPipelines / crmStages
crmCompanies 1─* crmContacts
crmCompanies 1─* crmDeals
crmContacts  1─* crmDeals
crmLeads     1─0/1 crmDeals (converted)
crmDeals     1─* crmQuotations 1─* crmQuotationItems
crmDeals     1─* crmTasks
crmCompanies / crmContacts / crmLeads / crmDeals / crmQuotations 1─* crmActivities
users        1─* crmEmailConnections 1─* crmEmailMessages
crmEmailConnections 1─1 crmEmailSyncState

Cross-boundary (reference only, never owned by CRM):
crmCompanies.accountingContactId ─► contacts
crmContacts.accountingContactId  ─► contacts
crmQuotations.invoiceId          ─► invoices
crmEmailMessages.dealId/…        ─► CRM entities
```

---

## 4. Tenant boundaries & access rules

1. **Every** CRM row has `orgId`. Every query/mutation takes `orgId` and calls
   `requireOrg` or `requireMember`; every fetch-by-id re-checks `doc.orgId`.
2. **Referenced IDs must belong to the same org.** When linking `companyId`,
   `contactId`, `dealId`, `quotationId`, verify `target.orgId === args.orgId`
   (as `invoicing.ts` does for contacts).
3. **No cross-tenant joins.** Enrichment loads related docs by id and drops any
   whose `orgId` differs.
4. **Platform cap** (`enabledModules`) and **role grants** apply via
   `requirePermission("crm-…")`.
5. **Token isolation:** `crmEmailConnections` token fields never leave Convex;
   only `{ provider, email, status, lastSyncedAt }` is returned.
6. **Backups/purge:** add all CRM tables to `convex/orgData.ts` `ORG_TABLES`
   (`convex/orgData.ts:9-35`) so per-company backup and hard-delete include them.

---

## 5. Index conventions summary

| Pattern | Use |
|---|---|
| `by_org` | list everything for a tenant |
| `by_org_<fk>` | list/filter children of a parent within a tenant |
| `by_org_status` / `by_org_stage` | pipeline/queue views |
| `by_entity (entityType, entityId)` | polymorphic activity lookup |
| `by_org_provider_message` | email idempotency/upsert |
| `by_user_provider` | per-user connection lookup (reuses calendar convention) |
