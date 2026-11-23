"use client";
// First-run mini guide — a compact "how it works" card shown above the Today
// panel until dismissed. Learnability: three steps, one screen, then it gets
// out of the way permanently (device-local flag, never synced).
// Implementation note: the flag is read via useSyncExternalStore — no effect,
// no hydration mismatch (the server snapshot is "dismissed"), and it reacts
// to both same-tab dismissal and cross-tab storage changes.
import { useSyncExternalStore } from "react";
import { CalendarCheck, BarChart3, PenLine, ShieldCheck, GraduationCap } from "lucide-react";

const KEY = "attendmate_tips_v1";
const EVENT = "attendmate_tips_change";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // another tab dismissed it
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return true; } // private mode → keep quiet
}
function getServerSnapshot(): boolean {
  return true; // never SSR the card; it appears after hydration
}

const STEPS = [
  {
    icon: PenLine,
    title: "Mark today's classes",
    body: "Scroll to your day below and tap Present, Absent or Cancelled on each slot — percentages update instantly.",
  },
  {
    icon: CalendarCheck,
    title: "Mark the day, fix it later",
    body: "Tap Present, Absent or Cancelled on each slot. Fell behind? Open any past day to edit it, or bulk-fill a whole date range in one go.",
  },
  {
    icon: BarChart3,
    title: "Plan with Analytics",
    body: "See per-subject attendance, safe-bunk advice and your projection to the end of the session.",
  },
];

export default function FirstRunTips() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (dismissed) return null;
  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* private mode — nothing to persist */ }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <section className="clay-card relative overflow-hidden border-orange-500/25 bg-gradient-to-br from-orange-500/[0.07] to-rose-500/[0.05] p-5" aria-label="Getting started">
      <GraduationCap className="h-4.5 w-4.5 text-orange-500" aria-hidden />
      <h2 className="mt-2 text-[15px] font-extrabold">New here? Three things to know</h2>
      <ol className="mt-3 space-y-2.5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400">
              <s.icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-bold leading-tight">{i + 1}. {s.title}</div>
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Everything stays on this device — nothing is uploaded.
        </span>
        <button
          onClick={dismiss}
          className="clay-btn clay-primary clay-sm ml-auto"
        >
          Got it — don&apos;t show again
        </button>
      </div>
    </section>
  );
}
