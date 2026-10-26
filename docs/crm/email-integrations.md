# CRM Email Integrations — Gmail & Microsoft Outlook

Status: **proposed** (awaiting approval). No OAuth apps or env vars have been
changed.

This design mirrors the existing calendar integration
(`src/lib/calendar/*`, `convex/calendar.ts`, `/api/integrations/*`), which already
implements OAuth, AES-256-GCM token encryption, signed OAuth state, a token-refresh
helper, a job queue, and a shared-secret sync runner. Reuse it rather than
inventing a parallel mechanism.

---

## 1. Common design

### 1.1 Provider interface

`src/lib/email/providers.ts` (server-only):

```ts
export type EmailProviderId = "gmail" | "outlook";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;   // epoch ms
  scope?: string;
}

export interface EmailIdentity { email: string | null; name?: string | null; }

export interface EmailSummary {
  providerMessageId: string;
  threadId?: string;
  internetMessageId?: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  cc?: string[];
  subject?: string;
  snippet?: string;
  receivedAt: number;
  hasAttachments?: boolean;
}

export interface EmailProvider {
  id: EmailProviderId;
  label: string;
  configured: boolean;
  authUrl(redirectUri: string, state: string, codeChallenge?: string): string;
  exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  getIdentity(accessToken: string): Promise<EmailIdentity>;
  listMessages(accessToken: string, cursor: string | null, limit: number):
    Promise<{ messages: EmailSummary[]; nextCursor: string | null }>;
  /** Phase 2 only. */
  sendMessage?(accessToken: string, draft: OutgoingEmail): Promise<{ providerMessageId: string }>;
}

export function getEmailProvider(id: string): EmailProvider | null;
```

- Token crypto: reuse `encryptToken`/`decryptToken` (`src/lib/calendar/crypto.ts`).
  Prefer moving it to `src/lib/crypto/tokens.ts` and re-exporting from both calendar
  and email to avoid duplication.
- OAuth state: reuse `signOAuthState`/`verifyOAuthState` (`src/lib/calendar/state.ts`),
  binding `{ userId, orgId, provider }`, 10-minute TTL. Extend the payload with a
  PKCE `codeVerifierHash` if PKCE is adopted (recommended).
- Redirect URIs (register exactly in each provider console):
  - `{APP_URL}/api/crm/integrations/gmail/callback`
  - `{APP_URL}/api/crm/integrations/outlook/callback`
- Routes:
  - `GET /api/crm/integrations/[provider]/connect` → build auth URL, redirect.
  - `GET /api/crm/integrations/[provider]/callback` → verify state, exchange code,
    encrypt + store tokens, redirect back to CRM settings.
  - `POST /api/crm/integrations/[provider]/disconnect` → delete connection + maps.
  - `GET|POST /api/crm/integrations/sync/run` → shared-secret runner (mirror
    `src/app/api/integrations/sync/run/route.ts`).

### 1.2 Credential storage

- Store **ciphertext only** in `crmEmailConnections.accessTokenEnc` /
  `refreshTokenEnc` (see `data-model.md`).
- Encryption: AES-256-GCM with `TOKEN_ENCRYPTION_KEY` (base64-encoded 32 bytes).
  Reuse `encryptionConfigured()` to fail fast with a clear 503.
- Query functions that return connections must strip token fields (follow
  `calendar.listMyConnections`, `convex/calendar.ts:74-94`).
- Never log tokens; never send them to the browser; never commit them.
- Key rotation: decrypt with old key / encrypt with new via a one-off internal
  migration; document `TOKEN_ENCRYPTION_KEY` rotation separately.

### 1.3 Refresh & error handling

- Refresh when `expiresAt - now < 60s` (same skew as `src/lib/calendar/sync.ts:41-51`).
- On `401`/invalid_grant: mark the connection `status: "error"`, store
  `lastError`, surface "Reconnect" in the UI, and stop syncing that mailbox until
  reconnected.
- All token writes are server-side mutations (`updateConnectionTokens` analog).

### 1.4 Sync model (read-first)

- Phase 1 is **read + link**; sending is Phase 2.
- Per-connection cursor is stored in `crmEmailSyncState.cursor`:
  - Gmail: `historyId` (from `users.getProfile`).
  - Outlook: `@odata.deltaLink`.
- Upsert is idempotent on `(orgId, provider, providerMessageId)`.
- Cached fields are **metadata only** by default (from/to/subject/snippet/dates);
  full bodies are fetched on demand or omitted (PII/retention decision).
- Linking: match `from`/`to` addresses to `crmContacts.email`, then to
  `crmCompanies.domain`; optionally link to an open `crmDeals`/`crmQuotations` via
  thread participants. Never auto-link across tenants.

### 1.5 Retries / backoff

- Sync runs are idempotent and resumable from the stored cursor.
- Retry transient errors (network, 429, 5xx) with exponential backoff
  (e.g. 1m, 5m, 30m, capped) and a per-connection attempt counter.
- Do not retry `invalid_grant` / 401 indefinitely — mark `error` and require reconnect.
- A runner drains a small batch per invocation (calendar uses `limit = 25`); schedule
  it via Vercel cron (or Convex cron) every few minutes.
- If an outbound send queue is added (Phase 2), use a jobs table analogous to
  `calendarSyncJobs` with `attempts`, `lastError`, `runAt`.

### 1.6 Security checklist

- [ ] OAuth authorization-code flow with signed `state` (and PKCE recommended).
- [ ] Least-privilege scopes (below).
- [ ] Tokens encrypted at rest; never returned by any query.
- [ ] Session + org binding re-verified in the callback (`session.id/orgId` must
      match the signed state) — as in `src/app/api/integrations/[provider]/callback/route.ts:33`.
- [ ] Disconnect deletes tokens; optionally call the provider's revoke endpoint.
- [ ] Rate-limit the connect endpoint per user.
- [ ] Audit connect/disconnect/sync-error events via `recordAudit`.
- [ ] No email content used for advertising; comply with Google Limited Use.

---

## 2. Gmail (Google)

### 2.1 Scopes (least privilege)

| Purpose | Scope | Sensitivity |
|---|---|---|
| Read messages/metadata | `https://www.googleapis.com/auth/gmail.readonly` | **Restricted** |
| Metadata only (optional) | `https://www.googleapis.com/auth/gmail.metadata` | Restricted |
| Send (Phase 2) | `https://www.googleapis.com/auth/gmail.send` | Sensitive |
| Identity | `openid`, `email`, `https://www.googleapis.com/auth/userinfo.email` | Non-sensitive |

Recommended Phase 1 scope set:
`gmail.readonly openid email https://www.googleapis.com/auth/userinfo.email`.

### 2.2 OAuth flow

- Endpoint: `https://accounts.google.com/o/oauth2/v2/auth`
- Params: `client_id`, `redirect_uri`, `response_type=code`, `scope`,
  `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`, `state`,
  and (recommended) `code_challenge`/`code_challenge_method=S256`.
- Token endpoint: `https://oauth2.googleapis.com/token`.
- Identity: `https://www.googleapis.com/oauth2/v2/userinfo` (or the `id_token`).

### 2.3 Sync

- Seed cursor: `GET https://gmail.googleapis.com/gmail/v1/users/me/profile` → `historyId`.
- Initial backfill: `users.messages.list` (e.g. `maxResults`, `q=-in:chats`) then
  `users.messages.get` with `format=metadata` and `metadataHeaders=From,To,Cc,Subject,Message-ID,Date`.
- Incremental: `users.history.list?startHistoryId=<cursor>` → new/deleted messages;
  advance the cursor to the latest `historyId`.
- Push (later): `users.watch` to a Pub/Sub topic + webhook. Watches expire in ~7 days
  and must be renewed; requires a public webhook and Pub/Sub setup. **Polling first.**
- Quotas/rate limits: handle 403 `rateLimitExceeded`/429 with backoff.

### 2.4 Production verification requirements (Gmail)

- [ ] Create/publish a Google Cloud project OAuth consent screen.
- [ ] Register both redirect URIs for every environment (prod + preview).
- [ ] **Restricted-scope verification + security assessment (CASA)** for
      `gmail.readonly` (and `gmail.send` if used). This can take weeks; until
      approved only test users can connect (cap ~100).
- [ ] Publish a privacy policy and terms; complete the Limited Use disclosure.
- [ ] Verify the app domain (`APP_URL` host).
- [ ] Configure `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (may reuse the calendar
      OAuth client if the same project/redirect scheme is acceptable; otherwise a
      dedicated client is safer).
- [ ] Confirm token encryption (`TOKEN_ENCRYPTION_KEY`) is set in production.

---

## 3. Microsoft Outlook (Microsoft Graph)

### 3.1 Scopes (delegated, least privilege)

| Purpose | Scope |
|---|---|
| Read mail | `Mail.Read` |
| Send (Phase 2) | `Mail.Send` |
| Identity | `User.Read`, `openid`, `email`, `profile` |
| Refresh token | `offline_access` |

Recommended Phase 1: `offline_access Mail.Read User.Read openid email`.
Use **delegated** permissions (per signed-in user), not application permissions,
to avoid org-wide mailbox access.

### 3.2 OAuth flow

- Authorize: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
  (use the tenant id instead of `common` for single-tenant deployments).
- Token: `https://login.microsoftonline.com/common/oauth2/v2.0/token`.
  Note Microsoft may rotate the refresh token; persist the returned one.
- Identity: `GET https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName`.

### 3.3 Sync

- Initial: `GET /me/mailFolders/inbox/messages?$select=...&$top=50`.
- Incremental: `GET /me/mailFolders/inbox/messages/delta` → follow
  `@odata.nextLink` until a `@odata.deltaLink` is returned; store that deltaLink as
  the cursor.
- Fields: `id`, `conversationId`, `internetMessageId`, `from`, `toRecipients`,
  `ccRecipients`, `subject`, `bodyPreview`, `receivedDateTime`, `hasAttachments`.
- Change notifications (later): Graph subscriptions expire (mail ≈ up to ~7 days)
  and need renewal; **polling with delta first**.

### 3.4 Production verification requirements (Graph)

- [ ] Azure AD app registration with the redirect URIs above (all environments).
- [ ] Delegated API permissions configured; **admin consent** granted where the
      tenant requires it.
- [ ] Multi-tenant app + **publisher verification** if onboarding external
      organisations.
- [ ] Client secret or certificate stored only in env (`MICROSOFT_CLIENT_SECRET`);
      rotate before expiry.
- [ ] Confirm `common` vs tenant-specific authority and document the choice.
- [ ] Token encryption + least-privilege scopes confirmed in production.

---

## 4. Environment variables

Reuse existing keys where possible (see `.env.example`):

| Var | Use |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (calendar and/or Gmail) |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth (calendar and/or Outlook) |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM key (base64 32 bytes) — **required** |
| `APP_URL` | Base for redirect URIs / links |
| `CALENDAR_SYNC_SECRET` **or** a new `CRM_EMAIL_SYNC_SECRET` | Authorises the sync runner |

Do not add secrets to source control. Use Vercel project env + `npx convex env set`
only for Convex-side values (there should be none for tokens — tokens live in the DB
encrypted and are handled in the Next server layer).

---

## 5. Scheduling

- Add a Vercel cron entry (e.g. every 5–15 minutes) for
  `/api/crm/integrations/sync/run`, authorised by the shared secret, mirroring the
  existing calendar runner. Alternatively, a Convex cron calling an HTTP action —
  but the existing convention runs provider HTTP calls from Next, so keep it there.
- Respect provider quotas: process a bounded batch per run and back off on 429.

---

## 6. Testing requirements for email

- **Adapter unit tests** with mocked `fetch`: auth URL shape, code exchange,
  refresh, 401 handling, Gmail history/delta parsing, Graph delta pagination.
- **Crypto tests**: encrypt→decrypt round-trip; tamper detection (GCM auth failure).
- **State tests**: expired/tampered state rejected; provider mismatch rejected.
- **Tenant tests**: a connection from org A cannot be read/used with org B's `orgId`.
- **Token secrecy test**: no CRM query returns `accessTokenEnc`/`refreshTokenEnc`.
- **Idempotency test**: the same provider message is upserted once.

---

## 7. Open items

- Google restricted-scope verification timeline (external blocker).
- Microsoft publisher verification (external blocker for multi-tenant).
- Whether Phase 1 stores snippets only or fetches bodies on demand.
- Whether to send email from the CRM in Phase 1 (recommend deferring to Phase 2).
- PKCE adoption (recommended) — requires storing the verifier between connect and
  callback (signed state or short-lived table).
