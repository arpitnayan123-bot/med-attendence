# AttendMate Pro — Full-Stack Web App

Unofficial, offline-first attendance intelligence for **NSMCH Bihta · Phase-III (Part-2) ·
Batch 2023 · Session 2026–27**, built with Next.js 16 (App Router) + TypeScript +
Tailwind CSS 4 + Prisma/SQLite, with the Originkit **Dither Reveal** on the landing page.

## Architecture

```
Landing (#/ · sign-in)          Originkit DitherReveal + real accounts (credentials only)
  ├─ email → exists? → login (password [+ 2FA]) | register (name, roll, password)
  └─ "Use this device only"    local-only mode, no server contact
Dashboard (#/dashboard)         9 views · offline-first · 40-step undo
  └─ every mutation → per-owner device store (localStorage), gated by the
     explicit storage consent — nothing is ever uploaded
Marketing (#/features | #/how-it-works | #/roster | #/faq | #/about) + 404
```

- `src/lib/attendmate/data.ts` — official subjects, master timetable, A1–F4 rosters, exams, modules
- `src/lib/attendmate/engine.ts` — pure logic: stats, bunk math, advice tiers, streaks, projection
- `src/lib/attendmate/activity.ts` — pure activity analytics: contribution-graph heat tiers, streaks, totals
- `src/lib/attendmate/storage.tsx` — state + undo + theme + per-owner device stores (consent-gated)
- `src/lib/attendmate/device-storage.ts` — storage consent, persistence request, usage, legacy migration
- `src/lib/attendmate/sync.ts` — credentials/security API client, 15s abort timeouts (no data sync exists)
- `src/lib/server/*` — auth (JWT/bcrypt), rate limiting, zod validation, route helpers

**Engineering hardening** — installable PWA (`manifest.webmanifest` + generated
icons); `public/sw.js` offline shell (cache-first hashed assets, network-first
documents, `/api/*` never cached, registration production-only); app-level error
boundary with a recovery card; all credential requests abort after 15 s.

**Unique rolls** — one roll number belongs to exactly one student: `db.user.rollNo` is
unique (register returns 409 on a duplicate), `GET /api/auth/roll?roll=N` (rate-limited,
no PII) powers a live availability check at sign-up, and the Today page's activity
panel opens with a student-ID strip (name · Roll No. · group/sub-group).

## Backend

**Schema** (`prisma/schema.prisma`, SQLite at `DATABASE_URL`) — **credential store only**:
`User` (email unique, bcrypt `passwordHash`, unique rollNo, 2FA + lockout fields) ·
`Session` (revocable device sessions) · `LoginEvent` (audit trail) · `AuthToken`
(single-use verify/reset tokens). **No user data tables** — attendance, baselines,
module progress, targets and theme are device-local by design (see "Privacy & data storage").

**API** (all mutating routes require `x-am-csrf: 1` + same-origin Origin; per-IP rate limits):

| Endpoint | Method | Purpose | Limit |
| --- | --- | --- | --- |
| `/api/health` | GET | liveness + db check | — |
| `/api/auth/exists` | POST | sign-in step 1 (account exists?) | 20 / 5 min |
| `/api/auth/register` | POST | create account + session | 5 / 10 min |
| `/api/auth/login` | POST | password sign-in (generic 401s) | 10 / 5 min |
| `/api/auth/totp` | POST | 2FA step (code or backup code) | 10 / 5 min |
| `/api/auth/logout` | POST | revoke session + clear cookie | 30 / 5 min |
| `/api/auth/me` | GET | current session user (credentials only) | — |
| `/api/auth/verify-password` | POST | step-up proof for destructive device actions | 5 / min |
| `/api/auth/security`, `/api/auth/2fa/*`, `/api/auth/sessions`, `/api/auth/change-password`, `/api/auth/reset*`, `/api/auth/verify` | | Tier 1+2 security surface | per-route |

**Privacy & data storage** — device-only by architecture. On first use the app asks
explicit permission ("Store your data on this device?"); allowing writes each owner's
data to `attendmate_pro_v2:<userId>` (guest: `:guest`) and requests
`navigator.storage.persist()`. Declining means zero writes (memory-only, question
reappears next visit — nothing, not even the choice, can be saved). Accounts on a
shared browser get isolated stores; sign-in switches stores and never moves data.
Moving devices = Export/Import backup files. The server never receives, stores, or
serves any attendance data.

## Environment

`.env` (gitignored):

```
DATABASE_URL=file:/absolute/path/db/custom.db
AUTH_SECRET=<openssl rand -hex 32>   # REQUIRED in production — app refuses to boot without it
```

## Production deployment

1. `bun install && bun run db:push` (or `prisma migrate deploy` once migrations are baselined).
2. Set `AUTH_SECRET` (rotate: new secret invalidates sessions; users just sign in again).
3. `bun run build && bun run start` — behind a TLS-terminating proxy (Caddy config included);
   the session cookie is `Secure` when `NODE_ENV=production`.
4. **Backups**: SQLite is a single file — `sqlite3 db/custom.db ".backup 'backups/$(date +%F).db'"`
   on a cron, or run Litestream for continuous replication to S3.
5. **Scaling out**: the rate limiter is in-memory (single process). Move it to Redis/Upstash
   before running multiple instances; Prisma can be pointed at Postgres by swapping the
   datasource provider — the schema is intentionally vanilla.

### Deploying to Vercel

Verified from a cold clone of this repo on a Vercel-equivalent environment:
`bun install --frozen-lockfile` → `next build` compiles clean with no local artifacts
and no env vars needed at build time. `vercel.json` pins the framework (Next.js), the
install command and the build command, so auto-detection cannot drift. If you have
previously overridden Build & Output settings in the Vercel dashboard, reset them to
defaults — dashboard overrides win over `vercel.json`.

1. Import the repo; framework Next.js; root directory = repo root.
2. Environment variables (Project → Settings → Environment Variables):
   - `AUTH_SECRET` — **required**; without it the auth module throws in production
     and every sign-in returns 500. Generate: `openssl rand -hex 32`.
   - `DATABASE_URL` — see the database note below.
   - optional: `RESEND_API_KEY` + `MAIL_FROM` for password-reset / verification mail
     (without them, mail is logged to the server console).
3. **Database note (important)**: Vercel functions have an ephemeral filesystem — a
   SQLite file does not persist across requests, so accounts and sessions would
   silently vanish. For Vercel, switch Prisma to a managed Postgres (Neon or Vercel
   Postgres): change `provider = "sqlite"` → `provider = "postgresql"` in
   `prisma/schema.prisma`, set `DATABASE_URL` to the Postgres connection string, run
   `bunx prisma db push` once against that URL to create the tables (User, Session,
   LoginEvent, AuthToken), then deploy. Keep SQLite for self-hosting — it remains the
   zero-ops choice there (backups above).
4. Redeploy after adding env vars so they are picked up by the running deployment.

## Security notes

- Passwords: bcrypt, 12 rounds. Sessions: HS256 JWT, 30-day expiry, httpOnly
  SameSite=Lax cookie, sub → DB lookup per request (revocable by deletion).
- CSRF: `SameSite=Lax` + same-origin Origin check + custom header (no preflight cross-site).
- Enumeration: login failures are a generic 401; registration duplicates are 409 (step 1
  "exists" is intentionally separate for the two-step UX and heavily rate-limited).
- Validation: every body is zod-parsed and size-capped (ops ≤ 500, payload ≤ 512 KB);
  slot ids, dates, subject codes and module keys are regex-validated server-side.

## Run locally

```bash
bun install
bun run db:push
bun run dev   # http://localhost:3000
```
