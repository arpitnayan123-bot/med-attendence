"use client";
// Marketing pages — minimal & simple: generous whitespace, clean type,
// violet accents. Views: Features · Guide · Roster · FAQ · About · 404.
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { BrandWord } from "./bits";
import { useAttendMate } from "@/lib/attendmate/storage";
import {
  SUBGROUP_RANGES, MINOR_ROSTER, MID_ROSTER, MAJOR_ROSTER, EXAM_CLINICAL_ROSTER, EXAMS,
  AETCOM_MODULES, PANDEMIC_MODULES,
} from "@/lib/attendmate/data";
import { getGroupInfo, getPersonalRosterTimeline, getClinicalPostingForDate, todayISO, formatDisplayDate } from "@/lib/attendmate/engine";

/* ---------------- shared chrome ---------------- */
export function SiteChrome({ route, nav, children }: {
  route: string; nav: (to: string) => void; children: React.ReactNode;
}) {
  const { state, setTheme } = useAttendMate();
  const [open, setOpen] = useState(false);
  const links = [
    ["features", "Features"], ["how-it-works", "Guide"], ["roster", "Roster"],
    ["faq", "FAQ"], ["about", "About"],
  ] as const;
  const signedIn = Boolean(state.profile.name);
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
          <Link href="/" onClick={(e) => { e.preventDefault(); nav(""); }} className="mr-auto" aria-label="AttendMate Pro home">
            <BrandWord size={32} />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(([r, label]) => (
              <button key={r} onClick={() => nav(r)}
                className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                  route === r ? "bg-violet-600/10 text-violet-700 dark:text-violet-300" : "text-muted-foreground hover:text-foreground"
                }`}>{label}</button>
            ))}
          </nav>
          <button onClick={() => setTheme(state.profile.theme === "dark" ? "light" : "dark")} aria-label="Toggle theme"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition hover:text-violet-600">
            {state.profile.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => nav(signedIn ? "dashboard" : "")}
            className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-[12.5px] font-bold text-white shadow-md shadow-violet-600/30 transition hover:brightness-110">
            {signedIn ? "Open App" : "Sign in"}
          </button>
          <button onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground md:hidden">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        {open && (
          <nav className="border-t px-5 py-2 md:hidden">
            {links.map(([r, label]) => (
              <button key={r} onClick={() => { nav(r); setOpen(false); }}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">{label}</button>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:grid-cols-3">
          <div>
            <BrandWord size={28} />
            <p className="mt-2.5 max-w-[32ch] text-[12px] leading-relaxed text-muted-foreground">
              Unofficial, offline-first attendance intelligence for NSMCH Bihta Phase-III (Part-2). Your data never leaves your device.
            </p>
          </div>
          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-wide">Site</h4>
            {links.map(([r, label]) => (
              <button key={r} onClick={() => nav(r)} className="block py-1 text-[12.5px] text-muted-foreground transition hover:text-violet-600">{label}</button>
            ))}
          </div>
          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-wide">Get started</h4>
            <button onClick={() => nav(signedIn ? "dashboard" : "")} className="block py-1 text-[12.5px] text-muted-foreground transition hover:text-violet-600">Open the dashboard</button>
            <button onClick={() => nav("how-it-works")} className="block py-1 text-[12.5px] text-muted-foreground transition hover:text-violet-600">Backups &amp; recovery</button>
            <button onClick={() => nav("faq")} className="block py-1 text-[12.5px] text-muted-foreground transition hover:text-violet-600">Privacy &amp; data</button>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-3 text-[11px] text-muted-foreground">
            <span>© {new Date().getFullYear()} AttendMate Pro · student-built, not affiliated with NSMCH or AKU</span>
            <span>Phase-III (Part-2) · Batch 2023 · Session 2026–27</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PageHero({ kick, title, lead }: { kick: string; title: React.ReactNode; lead: string }) {
  return (
    <header className="mx-auto max-w-3xl px-5 pb-6 pt-14 text-center">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">{kick}</div>
      <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mx-auto mt-3.5 max-w-[58ch] text-[14px] leading-relaxed text-muted-foreground">{lead}</p>
    </header>
  );
}

const CTA = ({ nav, label = "Open the dashboard" }: { nav: (to: string) => void; label?: string }) => {
  const { state } = useAttendMate();
  const signedIn = Boolean(state.profile.name);
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16">
      <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-500 px-6 py-12 text-center text-white shadow-xl shadow-violet-600/30">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Ready when you are.</h2>
        <p className="mx-auto mt-2.5 max-w-[52ch] text-[13.5px] text-white/85">
          {signedIn ? "Your dashboard is one tap away — sign-in already done." : "Sign in locally with your Gmail and roll number — it takes under a minute."}
        </p>
        <button onClick={() => nav(signedIn ? "dashboard" : "")}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[14px] font-bold text-violet-700 shadow-lg transition hover:bg-white/90">
          {label} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

/* ---------------- features ---------------- */
const FEATURE_LIST = [
  ["Roster resolver", "Enter your roll number (1–100) and the app maps it to one of 24 sub-groups (A1–F4), then resolves every clinical posting for the session: which department credits your 10 AM – 1 PM posting slot on any date, your full rotation timeline, and days left in each block — Allied, Specialty, Major and the final exam-oriented classes."],
  ["Safe-bunk planner", "For every subject and both modes, the planner computes exactly how many consecutive classes you can miss while staying above target — and, if you are below, how many you must attend in a row to recover. It also shows the precise percentage cost of the very next miss, so \"one class won't hurt\" is a claim you can check before making it."],
  ["Priority advisor", "Every subject is auto-tiered into Don't Miss / Be Careful / Safe to Miss. With little data the tiers use structure — short postings and low-frequency subjects land in Don't Miss; as your log grows, live percentages take over and re-rank on every mark."],
  ["Calendar heatmap", "A Monday-start month grid colours each logged day by its percentage, marks Sundays, dashed assessment windows from the official exam calendar, and shows the month's logged days, average and perfect days. Tap any day to open it."],
  ["Analytics & projection", "Six streak and volume stats, overall rings for theory, clinical and combined, a trend line of your last 15 logged days against the target, average performance per weekday, a full subject leaderboard, and a session-end projection to the Sentup exam at your current rate."],
  ["Offline & recoverable", "No account, no server, no network calls. Every action pushes onto a 40-step undo stack, past weeks can be bulk-filled, prior records imported as baselines, and one click exports a JSON backup you can re-import anywhere."],
] as const;

export function FeaturesPage({ nav }: { nav: (to: string) => void }) {
  return (
    <>
      <PageHero kick="Features" title={<>Everything the portal <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">doesn&apos;t tell you</span></>}
        lead="AttendMate Pro is a ground-up rebuild of the Attendmate concept, grounded in the real Phase-III (Part-2) timetable, the official posting rosters and the 75% / 80% rules." />
      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURE_LIST.map(([t, d], i) => (
          <div key={t} className="rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-[11px] font-extrabold text-violet-600 dark:text-violet-300">0{i + 1}</div>
            <h3 className="mt-1.5 text-[15px] font-extrabold">{t}</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
      <CTA nav={nav} />
    </>
  );
}

/* ---------------- guide ---------------- */
export function GuidePage({ nav }: { nav: (to: string) => void }) {
  const steps = [
    ["Sign in locally", "Open the app and sign in with your Gmail, name and roll number. Nothing is sent anywhere — the profile lives in your browser and instantly resolves your posting sub-group."],
    ["Mark the day", "Today's view lists every scheduled class from the master timetable. Tap Present, Absent or Cancel per class — or use “Mark all present” and fix exceptions. Sundays are pre-marked as the weekly holiday."],
    ["Read the advice", "Each subject shows a live tier — Don't Miss, Be Careful or Safe to Miss — with exact safe-skip or must-attend counts. Check it before deciding to bunk."],
  ] as const;
  const detail = [
    ["Day navigation and catch-up", "Arrows around the date header move through any day; “Copy previous day” clones yesterday's marks; the bulk-fill card marks a whole past range present or absent in one action, skipping Sundays and already-logged days. Started late? Back-fill three weeks in under a minute."],
    ["Extra and make-up classes", "Cancelled a class? Mark it Cancelled so it stops counting. Unplanned extra class? Add it from the extra-class form — it logs under the right subject and mode and appears in all totals immediately."],
    ["Baselines for prior records", "Tracked attendance elsewhere? Open any subject's details, enter prior present/total counts for theory and clinical, and the app merges them with everything you log from then on."],
    ["The what-if simulator", "Every subject card has a simulator: press “+1 attended” or “+1 missed” and watch the percentage and skip math update instantly — without touching your real log."],
    ["Clinical slot credits", "The 10 AM – 1 PM posting automatically credits the department your sub-group is rotating through on that date. If reality differs, the select on the slot re-credits it in one tap."],
    ["Backups and recovery", "Settings → Data exports a JSON of your entire state; import restores it on any device; Reset wipes cleanly. The 40-step undo covers every wrong tap inside the session."],
  ] as const;
  return (
    <>
      <PageHero kick="Guide" title={<>From zero to clarity in <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">one minute</span></>}
        lead="AttendMate Pro is designed around how a clinical day actually feels: no time for data entry, just enough for two taps." />
      <section className="mx-auto max-w-4xl px-5 pb-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map(([t, d], i) => (
            <div key={t} className="rounded-2xl border bg-card p-5 shadow-sm">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-[14px] font-extrabold text-white shadow-md shadow-violet-600/30">{i + 1}</span>
              <h3 className="mt-3 text-[14.5px] font-extrabold">{t}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 space-y-7">
          {detail.map(([t, d]) => (
            <div key={t}>
              <h3 className="text-[15px] font-extrabold">{t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <CTA nav={nav} />
    </>
  );
}

/* ---------------- roster ---------------- */
const DEPTS_MINOR = ["DR", "RD", "AN", "PS"] as const;
const DEPTS_MID = ["PE", "OR", "EN", "OP"] as const;
const DEPTS_MAJOR = ["IM", "SU", "OG"] as const;

export function RosterPage({ nav }: { nav: (to: string) => void }) {
  const { state } = useAttendMate();
  const [roll, setRoll] = useState<string>(state.profile.rollNo > 1 ? String(state.profile.rollNo) : "");
  const parsed = parseInt(roll, 10);
  const valid = parsed >= 1 && parsed <= 100;
  const gi = valid ? getGroupInfo(parsed) : null;
  const timeline = gi ? getPersonalRosterTimeline(gi.subGroup) : [];
  const today = todayISO();
  const now = gi ? getClinicalPostingForDate(today, gi.subGroup) : null;
  const upcoming = timeline.filter((r) => r.start > today).slice(0, 4);

  const table = (title: string, sub: string, rows: typeof MINOR_ROSTER, depts: readonly string[]) => (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b bg-muted/40 px-5 py-3">
        <h3 className="text-[13.5px] font-extrabold">{title}</h3>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12px]">
          <thead>
            <tr>
              <th className="bg-muted/60 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Window</th>
              {depts.map((d) => <th key={d} className="bg-muted/60 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.start} className="border-t transition hover:bg-muted/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDisplayDate(r.start)} → {formatDisplayDate(r.end)}</td>
                {depts.map((d) => {
                  const v = r[d] as string[] | undefined;
                  return (
                    <td key={d} className="px-4 py-2.5">
                      {v && <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                        gi && v.includes(gi.subGroup) ? "bg-violet-600 text-white" : gi && v.includes(gi.group) ? "bg-violet-600/15 text-violet-700 dark:text-violet-300" : "bg-muted text-muted-foreground"
                      }`}>{v.join(", ")}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <PageHero kick="Roster" title={<>Your roll number is <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">the key</span></>}
        lead="The Phase-III (Part-2) batch of 100 splits into six groups (A–F) and 24 sub-groups (A1–F4). Each rotates through Allied, Specialty and Major postings on official dates." />
      <section className="mx-auto max-w-6xl px-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h3 className="text-[16px] font-extrabold">Roll-number lookup</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              Resolves instantly on this page — nothing stored. In the dashboard the same resolution drives your posting timeline and which department your clinical slot credits each day.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                type="number" min={1} max={100} value={roll} onChange={(e) => setRoll(e.target.value)}
                placeholder="Roll no." aria-label="Roll number" inputMode="numeric"
                className="w-32 rounded-xl border bg-background px-4 py-2.5 text-[14px] font-bold outline-none focus:border-violet-500"
              />
              <span className="inline-flex items-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-[13px] font-bold text-white">Resolve</span>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm" aria-live="polite">
            {!valid ? (
              <p className="py-8 text-center text-[12.5px] text-muted-foreground">Enter a roll number between 1 and 100 to see the resolved group and posting timeline.</p>
            ) : (
              <div className="space-y-3.5">
                <div className="flex flex-wrap gap-2">
                  {[["Group", gi!.group], ["Sub-group", gi!.subGroup], ["Roll no.", String(parsed)], ["Rotations", String(timeline.length)]].map(([k, v]) => (
                    <span key={k} className="rounded-xl border bg-muted/50 px-3.5 py-2 text-center">
                      <b className="block bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-[14px] font-extrabold text-transparent">{v}</b>
                      <span className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{k}</span>
                    </span>
                  ))}
                </div>
                <div className="rounded-xl border p-3.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Current rotation (as of {formatDisplayDate(today)})</div>
                  <div className="mt-0.5 text-[14.5px] font-extrabold">{now ? `${now.name} (${now.code})` : "No rotation scheduled today"}</div>
                  {now && <div className="text-[11.5px] text-muted-foreground">{now.block} · {formatDisplayDate(now.start)} → {formatDisplayDate(now.end)}</div>}
                </div>
                {upcoming.length > 0 && (
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Next rotations</div>
                    {upcoming.map((r) => (
                      <div key={`${r.code}-${r.start}`} className="flex items-center justify-between gap-2 border-b border-dashed py-1.5 text-[12px] last:border-b-0">
                        <b className="truncate">{r.name} <span className="font-medium text-muted-foreground">({r.block})</span></b>
                        <span className="whitespace-nowrap text-muted-foreground">{formatDisplayDate(r.start)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl space-y-4 px-5 pt-8">
        {table("Minor — Allied Specialty rotations", "Two-week blocks through Dermatology, Radiodiagnosis, Anesthesiology and Psychiatry.", MINOR_ROSTER, DEPTS_MINOR)}
        {table("Mid — Specialty rotations", "Pediatrics, Orthopaedics + PMR, ENT and Ophthalmology, two sub-groups at a time.", MID_ROSTER, DEPTS_MID)}
        {table("Major — Clinical postings", "General Medicine, General Surgery and Obs-Gynae by whole group.", MAJOR_ROSTER, DEPTS_MAJOR)}
        {table("Exam-oriented clinical classes", "Final revision blocks before the university practicals.", EXAM_CLINICAL_ROSTER, DEPTS_MAJOR)}
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-[12px] text-muted-foreground">
          <b className="text-foreground">Dates do move.</b> These windows are transcribed from the official Phase-III (Part-2) schedule. If a block is revised, use the swap control on a clinical slot in the dashboard to credit the correct department.
        </p>
      </section>
      <div className="h-10" />
      <CTA nav={nav} />
    </>
  );
}

/* ---------------- faq ---------------- */
const FAQS = [
  ["General", [
    ["Is this the official NSMCH app?", "No. AttendMate Pro is an unofficial, student-built study tool. It replicates and upgrades the Attendmate concept using the published Phase-III (Part-2) timetable, assessment calendar and posting rosters. Always confirm critical dates with the college."],
    ["What does it actually calculate?", "Per-subject attendance for theory (75% target) and clinical (80% target), exact safe-skip counts, must-attend recovery plans, the percentage cost of the next miss, day and month summaries, streaks, and a session-end projection to the Sentup exam."],
    ["Can I change the targets?", "Yes — Settings → Attendance targets accepts any value between 1 and 100 per mode. All advice, tiers and projections recompute immediately."],
    ["Does it work on my phone?", "Yes — the whole app is responsive: the dashboard switches from a sidebar to a tab strip on small screens, and it keeps working fully offline once loaded."],
  ]],
  ["Privacy & data", [
    ["Does the sign-in send my data to Google?", "No. The sign-in is a local simulation: your email, name and roll number live only in your browser's localStorage. Nothing is transmitted anywhere — the app makes zero network calls."],
    ["Where does my attendance data live?", "Entirely in your browser, with a JSON export in Settings. Clearing browser data erases it, so export a backup regularly and import it on any new device."],
    ["Can I use it on two devices?", "Yes, with a manual sync: export the backup JSON from device one and import it on device two. No server means no automatic sync — by design, for privacy."],
  ]],
  ["Roster & accuracy", [
    ["What if a posting looks wrong for my group?", "The rosters are entered from the official schedule, but dates can shift. Verify with your class coordinator, and use the swap control on any clinical slot to credit the correct department for that day."],
    ["How does my roll number decide anything?", "Rolls 1–16 are Group A, 17–32 B, 33–49 C, 50–66 D, 67–83 E, 84–100 F — four sub-groups each (A1–F4). Sub-groups drive Allied and Specialty rotations; the parent group drives the Major postings."],
    ["Are holidays and exams accounted for?", "Sundays stop counting automatically. The official internal assessments, Sentup and the exam-oriented clinical blocks appear on the calendar and in the analytics horizon."],
  ]],
] as const;

export function FaqPage({ nav }: { nav: (to: string) => void }) {
  return (
    <>
      <PageHero kick="FAQ" title={<>Straight <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">answers</span></>}
        lead="The questions batchmates actually ask before trusting an app with their attendance record." />
      <section className="mx-auto max-w-3xl space-y-8 px-5 pb-8">
        {FAQS.map((group) => {
          const cat = group[0] as string;
          const items = group[1] as readonly (readonly [string, string])[];
          return (
          <div key={cat}>
            <h2 className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{cat}</h2>
            <div className="space-y-2.5">
              {items.map((qa) => {
                const q = qa[0];
                const a = qa[1];
                return (
                <details key={q} className="group rounded-2xl border bg-card px-5 py-1 shadow-sm open:border-violet-500/40">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-[14px] font-bold">
                    {q}
                    <span className="text-lg font-semibold text-violet-600 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="pb-4 text-[12.5px] leading-relaxed text-muted-foreground">{a}</p>
                </details>
                );
              })}
            </div>
          </div>
          );
        })}
      </section>
      <CTA nav={nav} />
    </>
  );
}

/* ---------------- about ---------------- */
export function AboutPage({ nav }: { nav: (to: string) => void }) {
  return (
    <>
      <PageHero kick="About" title={<>Built by a student, <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">for the batch</span></>}
        lead="AttendMate Pro began as a replica of the Attendmate tool used in Phase-III (Part-2) at NSMCH Bihta — and grew into a ground-up rebuild with real analytics." />
      <section className="mx-auto max-w-3xl space-y-7 px-5 pb-8">
        <div>
          <h2 className="text-[16px] font-extrabold">Why it exists</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Attendance in a clinical phase is genuinely hard to reason about. Postings move your whole sub-group every fortnight, theory runs at 75% while clinical runs at 80%, extra and cancelled classes bend the denominators, and the only tool most students have is mental arithmetic at 8:55 AM. AttendMate Pro takes the official schedule — the master Monday–Saturday timetable, the A1–F4 posting rosters, the assessment calendar — and keeps applying it to your running numbers, so every skip or save is an informed choice rather than a gamble.
          </p>
        </div>
        <div>
          <h2 className="text-[16px] font-extrabold">The principles</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground"><b className="text-foreground">Offline-first.</b> The whole app is static files — it works in a hostel with no wifi, because nothing phones home.</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground"><b className="text-foreground">Private by architecture.</b> No accounts, no servers, no analytics. Your email, roll number and every mark live in your browser&apos;s localStorage; the JSON export exists so you — not a vendor — own the copy that matters.</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground"><b className="text-foreground">Grounded in official data.</b> The rosters and exam windows are transcriptions of the Phase-III (Part-2) schedule, not guesses. When the college revises dates, the data is meant to be corrected.</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground"><b className="text-foreground">Honest arithmetic.</b> Advice states its assumptions: projections say “if your current rate holds”; simulators touch preview numbers only; cancelled classes stop counting instead of quietly punishing you.</p>
        </div>
        <div>
          <h2 className="text-[16px] font-extrabold">Disclaimer</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            AttendMate Pro is an unofficial tool by a student, for students. It is <b className="text-foreground">not</b> affiliated with, endorsed by, or produced on behalf of Nalanda Medical College &amp; Hospital (NSMCH), Patna, or Aryabhatta Knowledge University. The 75% / 80% rules reflect the published Phase-III (Part-2) requirements as understood at build time; the college&apos;s word always wins.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-[12.5px] text-muted-foreground">
          <b className="text-foreground">Contribute:</b> found a roster error, or the timetable changed? Every date on the <button onClick={() => nav("roster")} className="font-bold text-violet-600 underline underline-offset-2">roster page</button> is stored in plain arrays in the source — deliberately easy for any batchmate to correct.
        </div>
      </section>
      <CTA nav={nav} />
    </>
  );
}

/* ---------------- 404 ---------------- */
export function NotFoundPage({ nav }: { nav: (to: string) => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-8xl font-extrabold tracking-tight text-transparent sm:text-9xl">404</div>
      <h1 className="mt-2 text-xl font-extrabold">This page skipped class.</h1>
      <p className="mt-2 max-w-[44ch] text-[13px] text-muted-foreground">The address you followed doesn&apos;t exist — ironic, for an attendance app. Here&apos;s your absence excuse.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <button onClick={() => nav("")} className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-[13px] font-bold text-white shadow-md shadow-violet-600/30 transition hover:brightness-110">Back to sign-in</button>
        <button onClick={() => nav("features")} className="rounded-xl border px-5 py-2.5 text-[13px] font-bold text-muted-foreground transition hover:text-violet-600">See features</button>
      </div>
    </div>
  );
}

/* re-usable bits (kept here so marketing stays self-contained) */
export const MARKETING_COUNTS = {
  subjects: 13,
  subgroups: SUBGROUP_RANGES.length,
  minorBlocks: MINOR_ROSTER.length,
  midBlocks: MID_ROSTER.length,
  majorBlocks: MAJOR_ROSTER.length,
  exams: EXAMS.length,
  aetcom: AETCOM_MODULES.length,
  pandemic: PANDEMIC_MODULES.length,
};
