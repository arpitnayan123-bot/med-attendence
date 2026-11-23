"use client";
// Dashboard shell: sidebar (desktop) + tab strip (mobile), topbar with undo
// & theme, toast feedback, and the nine ported views.
import { ComponentType } from "react";
import {
  Home, CalendarDays, BookOpen, LineChart, Clock, Stethoscope, GraduationCap,
  ClipboardCheck, Settings, Undo2, Sun, Moon, LogIn, Cloud, CloudOff, CloudUpload, Loader2, TriangleAlert,
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

export default function Dashboard({ nav }: { nav: (to: string) => void }) {
  const { state, setState, undo, canUndo, lastAction, lastActionAt, setTheme, authed, syncStatus, pending, retrySync } = useAttendMate();

  const SYNC_MAP = {
    synced: { Icon: Cloud, cls: "text-emerald-500", label: "Synced" },
    saving: { Icon: Loader2, cls: "text-violet-500 animate-spin", label: "Saving…" },
    queued: { Icon: CloudUpload, cls: "text-violet-500", label: "Pending sync" },
    offline: { Icon: CloudOff, cls: "text-amber-500", label: "Offline — retrying" },
    error: { Icon: TriangleAlert, cls: "text-rose-500", label: "Sync error — retry" },
    local: null,
  } as const;
  const syncMeta = SYNC_MAP[syncStatus];

  if (!isSignedIn(state)) {
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
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">NSMCH Bihta · Phase-III (Part-2) · 2026–27</div>
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
            {syncMeta && (
              <button
                onClick={() => (syncStatus === "offline" || syncStatus === "error" ? retrySync() : undefined)}
                title={`Server sync: ${syncMeta.label}${pending > 0 ? ` (${pending})` : ""}`}
                aria-label={`Server sync: ${syncMeta.label}${pending > 0 ? ` (${pending})` : ""}`}
                className="clay-btn clay-soft h-9 rounded-[0.9rem] px-2.5 text-[11px] font-bold text-muted-foreground"
              >
                <syncMeta.Icon className={`h-4 w-4 ${syncMeta.cls}`} />
                <span className="hidden lg:inline">{syncMeta.label}{pending > 0 && syncStatus !== "saving" ? ` (${pending})` : ""}</span>
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

      {/* mobile tabs */}
      <div className="flex gap-1 overflow-x-auto border-b bg-card px-3 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setState((p) => ({ ...p, activeTab: id }))}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                state.activeTab === id ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/30" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
          <Active />
        </main>
      </div>

      {/* toast — remounts on every action, fades out via CSS (no timers) */}
      {lastAction && (
        <div
          key={lastActionAt}
          className="pointer-events-none fixed bottom-5 left-1/2 z-50 animate-toast rounded-full border bg-foreground px-4 py-2 text-[12.5px] font-semibold text-background shadow-xl"
        >
          {lastAction}
        </div>
      )}
    </div>
  );
}
