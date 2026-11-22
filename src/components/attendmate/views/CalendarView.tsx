"use client";
// Calendar view: month heatmap with assessment windows and month stats.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAttendMate } from "@/lib/attendmate/storage";
import { todayISO, monthMatrix, getGroupInfo, formatDisplayDate, getDayOfWeek } from "@/lib/attendmate/engine";
import { EXAMS } from "@/lib/attendmate/data";

const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function CalendarView() {
  const { state, setState } = useAttendMate();
  const t = todayISO();
  const [y, setY] = useState(parseInt(t.slice(0, 4), 10));
  const [m, setM] = useState(parseInt(t.slice(5, 7), 10) - 1);
  const cells = useMemo(() => monthMatrix(state, y, m), [state, y, m]);
  const subGroup = getGroupInfo(state.profile.rollNo).subGroup;

  const monthLogged = cells.filter((c) => c.date && c.logged);
  const avg = monthLogged.length
    ? monthLogged.reduce((a, c) => a + (c.pct || 0), 0) / monthLogged.filter((c) => c.pct !== null).length
    : null;
  const perfect = cells.filter((c) => c.date && c.pct !== null && c.pct >= 99.999).length;
  const holidays = cells.filter((c) => c.isHoliday).length;
  const monthExams = EXAMS.filter((e) => e.start.slice(0, 7) === `${y}-${String(m + 1).padStart(2, "0")}`);

  const cellStyle = (c: (typeof cells)[number]) => {
    if (!c.date) return "";
    if (c.isHoliday) return "bg-slate-500/10 text-slate-500";
    if (c.pct === null) return "bg-muted text-muted-foreground/70";
    if (c.pct >= state.profile.theoryTarget) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    if (c.pct >= state.profile.theoryTarget - 7.5) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  };

  return (
    <div className="space-y-5">
      <section className="clay-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(y, m - 1, 1); setY(d.getFullYear()); setM(d.getMonth()); }} aria-label="Previous month"
            className="clay-btn clay-soft clay-icon h-9 w-9 text-muted-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <h2 className="text-lg font-extrabold tracking-tight">
            {new Date(y, m, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </h2>
          <button onClick={() => { const d = new Date(y, m + 1, 1); setY(d.getFullYear()); setM(d.getMonth()); }} aria-label="Next month"
            className="clay-btn clay-soft clay-icon h-9 w-9 text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
          {(y !== parseInt(t.slice(0, 4), 10) || m !== parseInt(t.slice(5, 7), 10) - 1) && (
            <button onClick={() => { setY(parseInt(t.slice(0, 4), 10)); setM(parseInt(t.slice(5, 7), 10) - 1); }}
              className="clay-btn clay-soft clay-sm ml-auto">This month</button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {WD.map((w) => <div key={w} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{w}</div>)}
          {cells.map((c, i) => (
            <div key={i} className="relative">
              {c.date && (
                <button
                  onClick={() => { setState((p) => ({ ...p, selectedDate: c.date!, activeTab: "today" })); }}
                  title={c.date ? `${formatDisplayDate(c.date)}${c.pct !== null ? ` — ${c.pct.toFixed(0)}%` : c.isHoliday ? " — holiday" : " — unlogged"}` : ""}
                  className={`flex aspect-square w-full flex-col items-center justify-center rounded-xl text-[12.5px] font-bold transition hover:scale-[1.04] ${cellStyle(c)} ${
                    c.exam ? "outline-2 outline-dashed outline-rose-500/70 -outline-offset-2" : ""
                  } ${c.date === t ? "ring-2 ring-orange-500" : ""}`}
                >
                  <span>{parseInt(c.date.slice(8), 10)}</span>
                  {c.pct !== null && <span className="text-[8.5px] font-semibold opacity-80">{c.pct.toFixed(0)}%</span>}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[10.5px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-emerald-500/40" /> on target</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-500/40" /> close</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-rose-500/40" /> below</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-slate-500/20" /> holiday</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded ring-2 ring-inset ring-rose-500/60" /> assessment</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded ring-2 ring-orange-500" /> selected</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="clay-card p-4 text-center">
          <div className="text-xl font-extrabold">{monthLogged.length}</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">days logged</div>
        </div>
        <div className="clay-card p-4 text-center">
          <div className="text-xl font-extrabold">{avg === null || Number.isNaN(avg) ? "—" : `${avg.toFixed(1)}%`}</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">month avg</div>
        </div>
        <div className="clay-card p-4 text-center">
          <div className="text-xl font-extrabold">{perfect}</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">perfect days</div>
        </div>
        <div className="clay-card p-4 text-center">
          <div className="text-xl font-extrabold">{holidays}</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">holidays</div>
        </div>
      </section>

      {monthExams.length > 0 && (
        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 sm:p-5">
          <h3 className="text-[13.5px] font-extrabold text-rose-600 dark:text-rose-300">Assessments this month</h3>
          {monthExams.map((e) => (
            <p key={e.id} className="mt-1.5 text-[12.5px] text-muted-foreground">
              <b className="text-foreground">{e.name}</b> — {e.subjects} ({formatDisplayDate(e.start)} → {formatDisplayDate(e.end)})
            </p>
          ))}
        </section>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Tap any day to open it in the Today view · Sub-group {subGroup} · Sundays are the weekly holiday
      </p>
    </div>
  );
}
