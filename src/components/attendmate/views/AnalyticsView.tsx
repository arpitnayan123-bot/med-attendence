"use client";
// Analytics view: streaks, rings, trend, weekday averages, leaderboard,
// and the session-end projection to Sentup.
import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { useAttendMate } from "@/lib/attendmate/storage";
import { SUBJECTS } from "@/lib/attendmate/data";
import {
  computeSubjectStats, overallStats, streakInfo, trendSeries, weekdayAverages,
  projectSessionEnd, calcBunkInfo,
} from "@/lib/attendmate/engine";
import { Ring, Sparkline, StatCard, TierPill } from "../bits";

const WD_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AnalyticsView() {
  const { state, setState } = useAttendMate();
  const stats = useMemo(() => computeSubjectStats(state), [state]);
  const ov = useMemo(() => overallStats(state), [state]);
  const streaks = useMemo(() => streakInfo(state), [state]);
  const trend = useMemo(() => trendSeries(state, 15), [state]);
  const weekdays = useMemo(() => weekdayAverages(state), [state]);
  const proj = useMemo(() => projectSessionEnd(state), [state]);

  let holidays = 0, attended = 0;
  for (const day of Object.values(state.logs)) {
    for (const e of Object.values(day)) {
      if (e.status === "cancelled") holidays++;
      if (e.status === "present") attended++;
    }
  }

  const combT = ov.tT + ov.cT, combP = ov.tP + ov.cP;
  const combinedTarget = combT > 0 ? (ov.tT * state.profile.theoryTarget + ov.cT * state.profile.clinicalTarget) / combT : state.profile.theoryTarget;
  const mode = state.subjMode;
  const lbTarget = mode === "clinical" ? state.profile.clinicalTarget : state.profile.theoryTarget;

  const leaderboard = useMemo(() => SUBJECTS.map((s) => {
    const st = stats[s.code];
    const pr = mode === "clinical" ? st.clinical.present : st.theory.present;
    const tt = mode === "clinical" ? st.clinical.total : st.theory.total;
    return { s, pr, tt, pct: tt > 0 ? (pr / tt) * 100 : null, bunk: calcBunkInfo(pr, tt, lbTarget) };
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)), [stats, mode, lbTarget]);

  return (
    <div className="space-y-5">
      {/* streak + volume cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard value={streaks.totalLoggedDays} label="Days logged" accent="rgb(249 115 22)" />
        <StatCard value={<span>{streaks.current} 🔥</span>} label="Current perfect streak" accent="rgb(244 63 94)" />
        <StatCard value={streaks.best} label="Best streak" accent="rgb(245 158 11)" />
        <StatCard value={streaks.perfectDays} label="Perfect days (0 absent)" accent="rgb(16 185 129)" />
        <StatCard value={holidays} label="Holiday / cancelled days" accent="rgb(100 116 139)" />
        <StatCard value={attended} label="Classes attended" accent="rgb(234 88 12)" />
      </section>

      {/* rings */}
      <section className="clay-card p-5">
        <h2 className="text-[15px] font-extrabold">Overall attendance rings</h2>
        <p className="text-xs text-muted-foreground">Live percentage vs your targets across both modes</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl bg-muted/60 p-4">
            <Ring pct={ov.tT > 0 ? (ov.tP / ov.tT) * 100 : null} target={state.profile.theoryTarget} size={96} />
            <div className="text-[12.5px]">
              <div className="font-extrabold">Theory</div>
              <div className="text-muted-foreground">{ov.tT > 0 ? `${ov.tP}/${ov.tT}` : "no data"} · target {state.profile.theoryTarget}%</div>
              <div className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {ov.tT > 0 ? calcBunkInfo(ov.tP, ov.tT, state.profile.theoryTarget).message : "Log theory classes to unlock"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-muted/60 p-4">
            <Ring pct={ov.cT > 0 ? (ov.cP / ov.cT) * 100 : null} target={state.profile.clinicalTarget} size={96} />
            <div className="text-[12.5px]">
              <div className="font-extrabold">Clinical</div>
              <div className="text-muted-foreground">{ov.cT > 0 ? `${ov.cP}/${ov.cT}` : "no data"} · target {state.profile.clinicalTarget}%</div>
              <div className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {ov.cT > 0 ? calcBunkInfo(ov.cP, ov.cT, state.profile.clinicalTarget).message : "Log postings to unlock"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-muted/60 p-4">
            <Ring pct={combT > 0 ? (combP / combT) * 100 : null} target={combinedTarget} size={96} />
            <div className="text-[12.5px]">
              <div className="font-extrabold">Combined</div>
              <div className="text-muted-foreground">{combT > 0 ? `${combP}/${combT} total slots` : "no data"}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Theory + clinical, weighted targets</div>
            </div>
          </div>
        </div>
      </section>

      {/* trend */}
      <section className="clay-card p-5">
        <h2 className="text-[15px] font-extrabold">Day-by-day trend</h2>
        <p className="text-xs text-muted-foreground">Overall % of every logged day (most recent 15)</p>
        <div className="mt-3"><Sparkline points={trend} target={state.profile.theoryTarget} /></div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* weekday averages */}
        <section className="clay-card p-5">
          <h2 className="text-[15px] font-extrabold">Average by weekday</h2>
          <p className="text-xs text-muted-foreground">Where your week is strongest</p>
          <div className="mt-4 space-y-2.5">
            {weekdays.map((w, i) => (
              <div key={w.dow} className="flex items-center gap-3">
                <span className="w-9 text-[12px] font-bold text-muted-foreground">{WD_NAMES[i]}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500"
                    style={{ width: `${w.avg ?? 0}%` }} />
                </div>
                <span className="w-24 text-right text-[11.5px] font-bold">
                  {w.avg === null ? "—" : `${w.avg.toFixed(1)}%`}
                  <span className="ml-1 font-medium text-muted-foreground">({w.count}d)</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* projection */}
        <section className="clay-card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-extrabold"><TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-300" /> Projection to Sentup</h2>
          <p className="text-xs text-muted-foreground">Where you land on 24 Dec 2027 if your current rate holds</p>
          <div className="mt-4 flex items-center justify-around gap-2">
            <div className="text-center">
              <Ring pct={proj.theory} target={state.profile.theoryTarget} size={86} label="theory" />
              {proj.theory === null && <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Log a week to unlock</p>}
            </div>
            <div className="text-center">
              <Ring pct={proj.clinical} target={state.profile.clinicalTarget} size={86} label="clinical" />
              {proj.clinical === null && <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Log a week to unlock</p>}
            </div>
            <div className="text-center">
              <Ring pct={proj.combined} target={combinedTarget} size={86} label="combined" />
              {proj.combined === null && <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Log a week to unlock</p>}
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Remaining schedule: ~{proj.remT} theory slots · ~{proj.remC} posting days
          </p>
          <p className="mt-1 text-center text-[10.5px] text-muted-foreground">Assumes you keep your current rate.</p>
        </section>
      </div>

      {/* leaderboard */}
      <section className="clay-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-extrabold">Subject leaderboard</h2>
          <div className="inline-flex rounded-lg border bg-muted/60 p-0.5 text-[11px] font-bold">
            {(["theory", "clinical"] as const).map((m) => (
              <button key={m} onClick={() => setState((p) => ({ ...p, subjMode: m }))}
                className={`rounded-md px-2.5 py-1 capitalize ${mode === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {leaderboard.map((r, i) => (
            <div key={r.s.code} className="flex items-center gap-3 rounded-xl border p-2.5">
              <span className={`w-6 text-center text-[13px] font-extrabold ${i === 0 ? "text-amber-500" : i === leaderboard.length - 1 ? "text-rose-500" : "text-muted-foreground"}`}>{i + 1}</span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.s.color }} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{r.s.name}</span>
              <div className="hidden h-2.5 w-40 overflow-hidden rounded-full bg-muted sm:block">
                <div className="h-full rounded-full" style={{ width: `${r.pct ?? 0}%`, background: r.s.color }} />
              </div>
              <span className={`w-14 text-right text-[13px] font-extrabold ${r.pct === null ? "text-muted-foreground" : r.pct >= lbTarget ? "text-emerald-600 dark:text-emerald-400" : r.pct >= lbTarget - 7.5 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                {r.pct === null ? "—" : `${r.pct.toFixed(1)}%`}
              </span>
              {r.pct !== null && (
                <TierPill tier={r.bunk.status === "danger" ? "dont" : r.bunk.canBunk >= 2 ? "safe" : "careful"}>
                  {r.bunk.status === "danger" ? `+${r.bunk.mustAttend}` : `−${r.bunk.canBunk}`}
                </TierPill>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-muted-foreground">−N = safe skips left · +N = classes to attend · sorted by {mode} %</p>
      </section>
    </div>
  );
}
