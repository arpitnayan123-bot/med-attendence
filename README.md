# AttendMate Pro — Web App

Unofficial, offline-first attendance intelligence for **NSMCH Bihta · Phase-III (Part-2) ·
Batch 2023 · Session 2026–27**, rebuilt as a React app (Next.js 16 + TypeScript + Tailwind CSS 4)
with the Originkit **Dither Reveal** component on the landing page.

## Structure

- **Landing (`#/`)** — the sign-in page. Full-screen Originkit `DitherReveal`
  (`src/components/originkit/ui/dither-reveal.tsx`, installed via the Originkit CLI) over a dark
  background with a minimal glass sign-in card (email → name + roll number, stored locally).
- **Dashboard (`#/dashboard`)** — the full port of the original single-file AttendMate Pro:
  Today (marking, advice tiers, bulk fill, extra classes, CP swap), Calendar heatmap,
  Subjects (baselines + what-if simulator), Analytics (streaks, rings, trend, leaderboard,
  projection to Sentup), Timetable, Postings (official A1–F4 rosters), Exams, Modules
  (AETCOM + Pandemic), Settings (targets, JSON backup/restore, theme, sign out).
- **Marketing (`#/features`, `#/how-it-works`, `#/roster`, `#/faq`, `#/about`)** — minimal,
  simple pages; the roster page has a live roll-number lookup and all four official tables.
- **404** for unknown hashes.

## Key files

- `src/lib/attendmate/data.ts` — official subjects, master timetable, posting rosters, exams, modules
- `src/lib/attendmate/engine.ts` — pure logic: stats, bunk math, advice tiers, streaks, projection
- `src/lib/attendmate/storage.tsx` — localStorage persistence (`attendmate_pro_v2`, schema-compatible
  with the original app), 40-step undo, theme (shared `attendmate_site_theme` key)
- `src/components/attendmate/` — SignIn, Dashboard shell + 9 views, marketing pages

Everything runs on a single route (`src/app/page.tsx`) with hash navigation; no backend,
no network calls — data never leaves the browser.

## Run

```bash
bun install
bun run dev   # http://localhost:3000
```

Sign-in is a local simulation (no Google server). Export a JSON backup from Settings regularly.
