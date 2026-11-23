"use client";
// Dashboard shell: sidebar (desktop) + tab strip (mobile), topbar with undo
// & theme, toast feedback, and the nine ported views.
import { ComponentType, useEffect, useRef, useState } from "react";
import {
  Home, CalendarDays, BookOpen, LineChart, Clock, Stethoscope, GraduationCap,
  ClipboardCheck, Settings, Undo2, Sun, Moon, LogIn, HardDrive, HardDriveDownload, SaveOff, HardDriveUpload,
  MoreHorizontal, X,
} from "lucide-react";
import { useAttendMate, isSignedIn } from "@/lib/attendmate/storage";
import { getGroupInfo } from "@/lib/attendmate/engine";
import { BrandMark } from "./bits";
import TodayView from "./views/TodayView";
import CalendarView from "./views/CalendarView";
import SubjectsView from "./views/SubjectsView";
import AnalyticsView from "./views/AnalyticsView";
import { TimetableView, PostingsView, ExamsView, ModulesView, SettingsView } from "./views/MiscViews";

const TABS = [
  { id: "today", label: "Today", Icon: Home },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "subjects", label: "Subjects", Icon: BookOpen },
  { id: "analytics", label: "Analytics", Icon: LineChart },
  { id: "timetable", label: "Timetable", Icon: Clock },
  { id: "postings", label: "Postings", Icon: Stethoscope },
  { id: "exams", label: "Exams", Icon: GraduationCap },
  { id: "modules", label: "Modules", Icon: ClipboardCheck },
  { id: "settings", label: "Settings", Icon: Settings },
] as const;

const VIEW_MAP: Record<string, ComponentType> = {
  today: TodayView, calendar: CalendarView, subjects: SubjectsView, analytics: AnalyticsView,
  timetable: TimetableView, postings: PostingsView, exams: ExamsView, modules: ModulesView, settings: SettingsView,
};

/* Mobile: five primary tabs on a bottom bar; the rest live behind "More".
   Tab order here is the single source of truth for both mobile surfaces. */
const PRIMARY_TABS = ["today", "calendar", "subjects", "analytics"] as const;
const MORE_TABS = ["timetable", "postings", "exams", "modules", "settings"] as const;

export default function Dashboard({ nav }: { nav: (to: string) => void }) {
  const { state, setState, undo, canUndo, lastAction, lastActionAt, setTheme, authed, storageState, persistent } = useAttendMate();
  const [moreOpen, setMoreOpen] = useState(false);
  // Leaving "More" open with nothing to show, or open across tab switches, is
  // janky — close it whenever the active tab changes to a sheet tab.
  useEffect(() => { if (moreOpen && MORE_TABS.includes(state.activeTab as never)) setMoreOpen(false); }, [state.activeTab, moreOpen]);

  // Device-storage status chip: data lives on this device only (server holds
  // credentials). Clicking opens Settings → Storage on this device.
  const STORAGE_MAP = {
    granted: persistent
      ? { Icon: HardDriveDownload, cls: "text-emerald-500", label: "Saved on device · persistent" }
      : { Icon: HardDrive, cls: "text-emerald-500", label: "Saved on device" },
    denied: { Icon: HardDriveUpload, cls: "text-amber-500", label: "Not saving — memory only" },
    unknown: { Icon: HardDrive, cls: "text-muted-foreground", label: "Storage permission" },
  } as const;
  const storageMeta = STORAGE_MAP[storageState];

  // Same isolation rule as the app shell: an account-tagged device copy needs
  // that account's live session — a direct #/dashboard visit can't bypass it.
  if (!isSignedIn(state) || (Boolean(state.syncOwnerId) && !authed)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="relative w-full max-w-sm">
        <div className="clay-card w-full max-w-sm p-8 text-center">
          <BrandMark size={44} />
          <h1 className="mt-4 text-lg font-bold">Sign in required</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Your dashboard lives on this device — a quick local sign-in unlocks it.</p>
          <button onClick={() => nav("")} className="clay-btn clay-primary clay-lg mt-6 w-full">
            <LogIn className="h-4 w-4" /> Go to sign-in
          </button>
        </div>
      </div>
      </div>
    );
  }

  const Active = VIEW_MAP[state.activeTab] || TodayView;
  const subGroup = getGroupInfo(state.profile.rollNo).subGroup;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      {/* ambient wash — warm color pools, theme-aware */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-24 -top-32 h-96 w-96 rounded-full bg-orange-500/[0.10] blur-3xl dark:bg-orange-500/[0.16]" />
        <div className="absolute -right-28 top-1/3 h-[26rem] w-[26rem] rounded-full bg-rose-500/[0.08] blur-3xl dark:bg-rose-500/[0.13]" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-amber-500/[0.09] blur-3xl dark:bg-amber-500/[0.11]" />
      </div>

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card/95 backdrop-blur md:flex">
        <div className="flex items-center gap-3 px-5 py-4">
          <BrandMark size={38} />
          <div>
            <div className="text-[15px] font-extrabold leading-tight">AttendMate <span className="bg-gradient-to-r from-orange-600 to-rose-500 bg-clip-text text-transparent">Pro</span></div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">NSMCH Bihta · Phase-III (Part-2) · 2026–28</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setState((p) => ({ ...p, activeTab: id }))}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold transition ${
                state.activeTab === id
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/30"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-[17px] w-[17px]" /> {label}
            </button>
          ))}
        </nav>
        <div className="border-t px-5 py-3 text-[11px] text-muted-foreground">
          {state.profile.name} · Roll {state.profile.rollNo} · Sub-group {subGroup}
        </div>
      </aside>

      {/* main column */}
      <div className="relative z-10 md:pl-60">
        {/* topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-6">
          <div className="md:hidden"><BrandMark size={32} /></div>
          <h1 className="text-[15px] font-bold capitalize md:text-base">{state.activeTab}</h1>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => nav("")} title="Back to website" aria-label="Back to website"
              className="clay-btn clay-soft clay-icon h-9 w-9 text-muted-foreground">
              <Home className="h-4 w-4" />
            </button>
            {canUndo && (
              <button onClick={undo} title="Undo last action" aria-label="Undo"
                className="clay-btn clay-soft relative h-9 rounded-[0.9rem] px-2.5 text-[11px] text-muted-foreground">
                <Undo2 className="h-4 w-4" />
                <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">+</span>
              </button>
            )}
            {storageMeta && (
              <button
                onClick={() => setState((p) => ({ ...p, activeTab: "settings" }))}
                title={`Storage on this device: ${storageMeta.label}`}
                aria-label={`Storage on this device: ${storageMeta.label}`}
                className="clay-btn clay-soft h-9 rounded-[0.9rem] px-2.5 text-[11px] font-bold text-muted-foreground"
              >
                <storageMeta.Icon className={`h-4 w-4 ${storageMeta.cls}`} />
                <span className="hidden lg:inline">{storageMeta.label}</span>
              </button>
            )}
            <button
              onClick={() => setTheme(state.profile.theme === "dark" ? "light" : "dark")}
              aria-label="Toggle dark mode" title="Toggle dark mode"
              className="clay-btn clay-soft clay-icon h-9 w-9 text-muted-foreground"
            >
              {state.profile.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setState((p) => ({ ...p, activeTab: "settings" }))}
              className="ml-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-[13px] font-bold text-white shadow-md shadow-orange-500/30"
              aria-label="Profile settings"
            >
              {(state.profile.name || "A").charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-24 py-5 md:px-6 md:pb-10">
          <Active />
        </main>
      </div>

      {/* mobile bottom tab bar — five primary tabs; everything else in More */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur md:hidden" aria-label="Primary">
        <div className="grid grid-cols-5">
          {PRIMARY_TABS.map((id) => {
            const t = TABS.find((x) => x.id === id)!;
            const active = state.activeTab === id;
            return (
              <button key={id} onClick={() => setState((p) => ({ ...p, activeTab: id }))}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-bold transition ${
                  active ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
                }`}>
                <t.Icon className={`h-5 w-5 ${active ? "stroke-[2.4]" : ""}`} />
                {t.label}
                {active && <span className="h-0.5 w-6 rounded-full bg-gradient-to-r from-orange-500 to-rose-500" />}
              </button>
            );
          })}
          <button onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog" aria-expanded={moreOpen}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-bold transition ${
              MORE_TABS.includes(state.activeTab as never) ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
            }`}>
            <MoreHorizontal className="h-5 w-5" /> More
            {MORE_TABS.includes(state.activeTab as never) && <span className="h-0.5 w-6 rounded-full bg-gradient-to-r from-orange-500 to-rose-500" />}
          </button>
        </div>
      </nav>

      {/* More sheet — bottom sheet on mobile */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 flex items-end md:hidden" role="dialog" aria-modal="true" aria-label="More tabs">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="relative w-full rounded-t-3xl border border-border bg-card p-4 pb-6 shadow-2xl">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[14px] font-extrabold">More</h2>
              <button onClick={() => setMoreOpen(false)} aria-label="Close menu" className="clay-btn clay-soft clay-icon h-8 w-8 text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {MORE_TABS.map((id) => {
                const t = TABS.find((x) => x.id === id)!;
                const active = state.activeTab === id;
                return (
                  <button key={id} onClick={() => { setState((p) => ({ ...p, activeTab: id })); setMoreOpen(false); }}
                    className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-[13px] font-bold transition ${
                      active ? "border-orange-400 bg-orange-500/10 text-orange-600 dark:text-orange-400" : "border-border text-muted-foreground hover:bg-muted"
                    }`}>
                    <t.Icon className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* toast — remounts on every action, fades out via CSS (no timers) */}
      {lastAction && (
        <div
          key={lastActionAt}
          className="pointer-events-none fixed bottom-24 left-1/2 z-50 animate-toast md:bottom-5 rounded-full border bg-foreground px-4 py-2 text-[12.5px] font-semibold text-background shadow-xl"
        >
          {lastAction}
        </div>
      )}
    </div>
  );
}
