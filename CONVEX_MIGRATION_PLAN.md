# Office Manager — Convex Migration Plan

**Goal:** Move the office management app from local SQLite to Convex so all data lives in the cloud — eliminating the "computer crashed, data gone" risk and adding real-time updates for free.

**Current stack:** Next.js 15 + better-sqlite3 (local file DB) + custom JWT cookie auth
**Target stack:** Next.js 15 (UI kept as-is) + Convex (DB, backend logic, cron, file storage) + same JWT auth or Convex Auth
**Scale:** 10 users — Convex free tier covers this comfortably.

---

## What we keep vs. replace

| Layer | Now | After migration |
|---|---|---|
| UI pages (login, dashboard, leave, cars, petty cash, meetings, minutes, profile, team) | Next.js + Tailwind | **Kept** — mostly unchanged |
| API routes (`src/app/api/**`) | Next.js route handlers + SQL | **Replaced** by Convex queries/mutations/actions called directly from the UI via hooks |
| Database | `data/office.db` (SQLite) | Convex cloud tables (managed, versioned, backed up by Convex) |
| Auth | jose JWT in httpOnly cookie | Keep the same mechanism (validated inside Convex functions) — see Decision A |
| Email / SMS / OpenAI calls | Direct fetch in route handlers | Convex **actions** (same Resend/TalkSasa/OpenAI code) |
| Annual leave reset (Jan 1) | Checked on server start | Convex **cron job** (runs reliably even if nobody logs in) |
| Minutes attachments | Local `data/uploads/` folder | **Convex file storage** |

---

## Phase 0 — Decisions to make first (15 min)

- **A. Auth approach:**
  - *Option 1 (recommended):* keep current login page + jose cookie; pass/verify session in Convex via an authenticated client. Least UI churn, everything already works.
  - *Option 2:* adopt Convex Auth (built-in). More idiomatic but rewrites login/change-password flows.
- **B. Project layout:** convert this repo in place (recommended) vs. fresh repo. In-place keeps git history.
- **C. Cutover:** run Convex version alongside SQLite version until sign-off, then retire `src/app/api` routes.

## Phase 1 — Setup (30 min)

- [ ] `npm install convex`
- [ ] `npx convex dev` → create/link Convex project (needs Convex account login)
- [ ] Create `convex/schema.ts` defining all tables (below)
- [ ] Add `NEXT_PUBLIC_CONVEX_URL` to `.env`; wire `ConvexClientProvider` into `src/app/layout.tsx`

### Schema (convex/schema.ts)

```
users            name, email(unique index), phone, passwordHash, role, leaveBalance,
                 mustChangePassword, active, createdAt
leaves           userId, startDate, endDate, days, leaveType, reason,
                 status, approvedBy, approvedAt, adminNote, createdAt
carLogs          vehicleReg, category, description, vendor, amount, logDate,
                 status, requestedBy, approvedBy, approvedAt, note, requisitionNo
pettyCash        requestedBy, amount, purpose, dateNeeded, status,
                 approvedBy, approvedAt, paidAt, note, requisitionNo
meetings         title, agenda, location, scheduledAt, attendeeIds[], directorId,
                 status, createdBy
minutes          meetingId?, title, meetingDate, attendeesText, points, content,
                 fileId?, fileName?, aiGenerated, status, writtenBy
profileRequests  userId, field("name"|"email"), currentValue, requestedValue,
                 status, reviewedBy, reviewedAt
settings         key, value   (backup config etc., if ever needed)
annualAudit      year, userId, allocatedDays  (optional, for leave history per year)
```

Indexes: `users.by_email`, `leaves.by_user`, `leaves.by_status`, `carLogs.by_status`, `pettyCash.by_status`, `minutes.by_meeting`, `profileRequests.by_status`.

## Phase 2 — Port backend logic to Convex functions (2–3 hrs)

Map every existing route to a function in `convex/`:

| File today | Becomes |
|---|---|
| `api/auth` (login/logout/me) | `sessions.ts`: keep issuing our JWT cookie from a Next route OR Convex Auth (Decision A) |
| `api/auth/change-password` | mutation `changePassword` (bcrypt compare/hash inside action — bcryptjs is Node-only → use action, not pure mutation) |
| `api/users` + `[id]` | `users.ts`: list/create/patch/deactivate + temp-password generation + credentials action |
| `api/leaves` + `[id]` | `leaves.ts`: apply (transactional balance deduct), approve/reject (refund), admin edit with delta adjust, delete |
| `api/car-logs` + `[id]` | `carLogs.ts` + approval mutations + requisition number generation |
| `api/petty-cash` + `[id]` | `pettyCash.ts` incl. approve/reject/paid |
| `api/meetings` + `[id]` | `meetings.ts` + invite notifications action |
| `api/minutes*` + upload + files | `minutes.ts` + Convex storage (`ctx.storage`) for attachments; AI generate = action |
| `api/dashboard` | query `dashboardStats` (replaces itself automatically — live data) |
| `api/profile*` | `profiles.ts`: phone self-update + change-request workflow |

Business rules to preserve exactly:
1. Leave: 21 days/year, deducted at submission, refunded on reject/delete, insufficient-balance check, employee requests immutable (admin-only edits).
2. Roles enforced server-side in every function (`requireRole(ctx)` helper): admin=director full rights; manager=cars+requisitions; secretary=meetings+minutes; employee=self only.
3. Notifications fire after successful writes (actions), never block/fail the write.
4. Requisition numbers `RQ-CAR-xxxx` / `RQ-PC-xxxx`.

## Phase 3 — Rewire frontend (2–3 hrs)

- Replace `fetch("/api/...")` calls with `useQuery` / `useMutation` / `useAction` hooks — pages get **live auto-refresh** (dashboard, approvals lists update instantly for everyone).
- Delete `src/app/api/**` once pages are switched.
- Requisition print pages read via a server-side Convex client instead of direct DB import.
- Login/change-password stay as Next.js routes calling Convex actions (per Decision A).

## Phase 4 — Cron & background (30 min)

- `convex/crons.ts`: job on Jan 1 (and a daily safety check) resetting active users' `leaveBalance` to 21 for the new year.
- Optional: daily backup snapshot reminder email to director (Convex data is already replicated/backed up by Convex).

## Phase 5 — Seed & env (20 min)

- Seed script/action: create director account from `.env` (ADMIN_EMAIL/PASSWORD) if `users` table empty.
- Env vars move where needed: `AUTH_SECRET` stays server-side; `RESEND_API_KEY`, `TALKSASA_API_KEY`, `OPENAI_API_KEY` become Convex environment variables (`npx convex env set ...`) since actions run on Convex.

## Phase 6 — Full regression test (~45 min)

Repeat today's smoke tests against Convex build:
- [ ] Login → forced password change → dashboard
- [ ] Create user (temp pw shown/sent), change role, disable
- [ ] Employee: apply sick/bereavement/etc. leave → balance 21→16 → edit blocked (403)
- [ ] Admin approve/reject → refund correct → notifications sent (check Resend/TalkSasa logs)
- [ ] Car log entry → manager edit → admin approve → requisition page prints
- [ ] Petty cash request → approve → mark paid → form prints
- [ ] Meeting schedule → attendees notified
- [ ] Minutes: points → AI generate → save draft/final → attach file → download works
- [ ] Profile: phone self-change instant; name/email request → admin approves → takes effect
- [ ] Two browsers open: approval appears live without refresh

## Phase 7 — Cleanup & docs (20 min)

- Remove better-sqlite3/bcrypt-from-routes leftovers; delete `data/` handling code
- Update README (setup now: `npx convex dev`, env vars, no local DB)
- Tag git commit "sqlite-final-backup" before cutover so the old version is always recoverable

---

## Risk notes

- bcrypt can't run in Convex mutations (no Node APIs there) → hashing must happen in **actions**, or swap to Web Crypto PBKDF2. Decide in Phase 0.
- TalkSasa/Resend calls move to Convex actions — outbound HTTP is allowed there.
- Convex free tier limits are generous (well above 10-user needs); monitor usage in dashboard.
- Data currently in local SQLite (test data only right now — DB was reset) needs no migration. If any real records exist tomorrow, export them first.

**Estimated total: ~6–8 hours of focused work.**
