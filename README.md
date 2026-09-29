# Office Manager

A lightweight office management web app for a ~10-person office, built with **Next.js 15 + Convex** (cloud database — no local data files to lose).

## Features

| Module | Who can do what |
|---|---|
| **Leave** | Everyone applies (21 days/year auto-allocated, deducted on submission) choosing a type: Annual, Sick, Bereavement, Maternity, Paternity, Personal or Other. Submitted requests are **locked** — only the admin can edit/approve/reject/delete. Rejected requests refund days. Balances reset every January automatically. |
| **Profile** | Everyone can change their own phone number. Name/email changes go to the admin as an approval request — admins review them in the Team page. |
| **Car repairs & insurance** | Manager/admin log entries (repair / insurance / service). Admin approves/rejects. Manager & admin get a printable requisition form (`RQ-CAR-xxxx`). |
| **Petty cash** | Anyone requests funds. Admin approves → marks paid. Printable requisition form (`RQ-PC-xxxx`). |
| **Meetings** | Secretary/admin schedule board/directors' meetings, pick attendees; invitees get email + SMS invites. |
| **Minutes** | Secretary/admin write minutes from rough points and click **"Generate with AI"** to draft formal minutes via OpenAI. Attach files (PDF/DOCX/images, stored in Convex file storage). Mark draft/final. |
| **Team (admin)** | Director creates users — a temporary password is generated and sent by **email + SMS**; the user must change it at first login. Change roles, disable users, reset passwords, adjust leave balances. |
| **Multi-company** | Every organization gets its own isolated workspace — staff, requests and records are never shared across companies. |

Notifications: leave applications notify the director; decisions notify the employee; meetings notify attendees.

## Roles

- `admin` — the Director: full rights over everything
- `manager` — car logs (enter/edit), petty cash & car requisition forms
- `secretary` — meetings + minutes (write/upload/edit/AI)
- `employee` — leave applications, petty cash requests, own dashboard

## First run

```bash
npm install
npx convex dev      # one-time: links the Convex project and pushes backend functions
npm run build
npm run start       # or: npm run dev
```

On first login attempt an **admin account is seeded** automatically into Convex from `.env`:

```
email:    director@office.local   (ADMIN_EMAIL)
password: ChangeMe123!            (ADMIN_PASSWORD)
```

You'll be forced to set a new password immediately after logging in.

## Multi-tenancy

The app supports multiple companies on one deployment. Each organization has its own
users, leaves, car logs, petty cash, meetings and minutes — fully isolated at the
database layer (every record carries an `orgId`).

- The **default organization** is created automatically on first run (name it with `ORG_NAME`).
- Register additional companies with the platform-owner script:

```bash
node scripts/create-company.mjs "Acme Ltd" boss@acme.co.ke "Jane Doe"
# prints the new admin's email + temporary password
```

Emails are unique across the whole platform (they are the login key); each account
belongs to exactly one organization.

## Form validation

All forms (login, password change, leave, car logs, petty cash, meetings, minutes,
user creation, profile changes) validate client-side before submitting — required
fields, email/phone formats, date ordering, positive amounts — showing inline red
errors under each field. The server re-validates everything independently.

## Configuration

Copy `.env.example` → `.env` and fill in:

| Key | Purpose |
|---|---|
| `AUTH_SECRET` | Random string for session cookies (already generated) |
| `CONVEX_SERVER_SECRET` | Shared secret between the Next.js API routes and Convex functions (already generated; also stored in the deployment's env via `npx convex env set CONVEX_SERVER_SECRET ...`) |
| `ADMIN_NAME / ADMIN_EMAIL / ADMIN_PHONE / ADMIN_PASSWORD` | Seeded director account |
| `RESEND_API_KEY` | [resend.com](https://resend.com) API key for email |
| `EMAIL_FROM` | e.g. `Office <noreply@yourdomain.co.ke>` (verify your domain in Resend) |
| `DEEPSEEK_API_KEY` | For AI minutes generation ([platform.deepseek.com](https://platform.deepseek.com)) — OpenAI-compatible |
| `DEEPSEEK_MODEL` | Defaults to `deepseek-v4-flash` |
| `TALKSASA_API_KEY` | TalkSasa bulk SMS API key |
| `TALKSASA_SENDER_ID` | Your registered sender ID (max 11 chars) |
| `TALKSASA_BASE_URL` | Defaults to `https://bulksms.talksasa.com/api/v3` |
| `APP_URL` | Public URL used in links inside emails |
| `COOKIE_SECURE` | Leave unset for HTTP/LAN; set `true` when serving over HTTPS |

`.env.local` is managed by the Convex CLI (`CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`) — don't edit it manually.

Missing keys don't break the app — notifications are skipped with a console warning, and AI generation returns a clear message until the key is added.

## Architecture

```
Browser ──▶ Next.js pages (UI)
Browser ──▶ Next.js API routes  ──▶  Convex functions (cloud DB + file storage)
              │  session cookie auth (JWT)     │  server-secret guard on every call
              └─ email/SMS/AI integrations ────┘
```

All data lives in your Convex project (dashboard: `npx convex dashboard`). Uploaded attachments are stored in Convex file storage.

## Scripts

```bash
npm run dev             # development server
npx convex dev          # push/watch Convex functions during development
npm run build           # production build
npm run start           # run production build
npx convex env list     # view deployment environment variables
npx convex data         # inspect tables
```
