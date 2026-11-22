# AttendMate Pro — Full-Stack Web App

Unofficial, offline-first attendance intelligence for **NSMCH Bihta · Phase-III (Part-2) ·
Batch 2023 · Session 2026–27**, built with Next.js 16 (App Router) + TypeScript +
Tailwind CSS 4 + Prisma/SQLite, with the Originkit **Dither Reveal** on the landing page.

## Architecture

```
Landing (#/ · sign-in)          Originkit DitherReveal + real accounts
  ├─ email → exists? → login (password) | register (name, roll, password)
  └─ "Use this device only"    local-only mode, no server contact
Dashboard (#/dashboard)         9 views · offline-first · 40-step undo
  └─ every mutation → diff → keyed op queue → POST /api/sync (debounced 900 ms)
Marketing (#/features | #/how-it-works | #/roster | #/faq | #/about) + 404
```

- `src/lib/attendmate/data.ts` — official subjects, master timetable, A1–F4 rosters, exams, modules
- `src/lib/attendmate/engine.ts` — pure logic: stats, bunk math, advice tiers, streaks, projection
- `src/lib/attendmate/storage.tsx` — state + undo + theme + sync bridge (diff → op queue)
- `src/lib/attendmate/sync.ts` — API client, queue coalescing, pull-merge (per-key LWW)
- `src/lib/server/*` — auth (JWT/bcrypt), rate limiting, zod validation, route helpers

## Backend

**Schema** (`prisma/schema.prisma`, SQLite at `DATABASE_URL`):
`User` (email unique, bcrypt `passwordHash`, rollNo, targets, theme) ·
`AttendanceLog` (unique per user+date+slot) · `Baseline` (per subject) ·
`ModuleDone` (per module key). All child rows cascade on account deletion.

**API** (all mutating routes require `x-am-csrf: 1` + same-origin Origin; per-IP rate limits):

| Endpoint | Method | Purpose | Limit |
| --- | --- | --- | --- |
| `/api/health` | GET | liveness + db check | — |
| `/api/auth/exists` | POST | sign-in step 1 (account exists?) | 20 / 5 min |
| `/api/auth/register` | POST | create account + session | 5 / 10 min |
| `/api/auth/login` | POST | password sign-in (generic 401s) | 10 / 5 min |
| `/api/auth/logout` | POST | clear session cookie | 30 / 5 min |
| `/api/auth/me` | GET | current session user | — |
| `/api/sync` | GET | full snapshot (profile, logs, baselines, modules) | — |
| `/api/sync` | POST | apply ≤500 ops (upsert/delete, transactional) | 60 / min |
| `/api/sync` | DELETE | wipe account's attendance data | 5 / min |

**Sync model** — offline-first with last-write-wins per key:
mutations land in localStorage instantly and a keyed queue (`attendmate_sync_queue`);
flushes are debounced and retried with backoff; on sign-in the server snapshot is
merged (newer queued op wins, otherwise server wins; local-only records migrate up).
The browser keeps working with zero connectivity — the topbar chip shows
Saving / Synced / Pending (n) / Offline / Error.

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
