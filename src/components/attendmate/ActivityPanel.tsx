"use client";
// "Your work, at a glance" — GitHub-contribution-style heatmap + LeetCode-style
// stat tiles, rendered at the top of the Today view. Everything is computed
// on-device from the user's own logs (device-only data model).
import { Flame, HardDrive, Activity } from "lucide-react";
import { ReactNode } from "react";
import { AppState } from "@/lib/attendmate/data";
import { buildHeatmapWeeks, computeActivityStats, ActivityDay } from "@/lib/attendmate/activity";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TIER_CLS = [
  "bg-stone-200/80 dark:bg-stone-700/50",
  "bg-emerald-200 dark:bg-emerald-500/25",
  "bg-emerald-300 dark:bg-emerald-500/45",
  "bg-emerald-500/80 dark:bg-emerald-500/70",
  "bg-emerald-600 dark:bg-emerald-400",
] as const;

function dayTitle(d: ActivityDay, isToday: boolean): string {
  const date = `${d.iso.slice(8, 10)} ${MONTHS[Number(d.iso.slice(5, 7)) - 1]}`;
  if (d.marked === 0) return `${date}${isToday ? " · today" : ""} — nothing logged`;
  const pct = d.scheduled > 0 ? ` (${Math.round((d.marked / d.scheduled) * 100)}% of ${d.scheduled})` : "";
  return `${date}${isToday ? " · today" : ""} — ${d.marked} marked${pct}, ${d.present} present`;
}

function StatTile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="flex-1 min-w-[104px] rounded-2xl border bg-card/70 px-3 py-2.5 text-center">
      <div className={`text-lg font-extrabold leading-none ${accent || "text-foreground"}`}>{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export default function ActivityPanel({ state }: { state: AppState }) {
  const weeks = 18;
  // React Compiler memoizes these from `state`; no manual useMemo needed.
  const cols = buildHeatmapWeeks(state, weeks);
  const stats = computeActivityStats(state, weeks);
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  /* month labels: a label on the first column whose first day starts a new month */
  const monthLabels: (string | null)[] = [];
  let lastMonth = -1;
  for (const col of cols) {
    const m = Number(col[0].iso.slice(5, 7)) - 1;
    monthLabels.push(m !== lastMonth ? MONTHS[m] : null);
    lastMonth = m;
  }

  const presentRate = stats.totalMarks > 0 ? Math.round((stats.totalPresent / stats.totalMarks) * 100) : 0;

  return (
    <section className="clay-card p-5" aria-label="Your activity">
      <div className="flex flex-wrap items-center gap-2">
        <Activity className="h-4.5 w-4.5 text-emerald-500" />
        <h2 className="text-[15px] font-extrabold">Your work, at a glance</h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <HardDrive className="h-3 w-3" /> computed on-device
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatTile label="marks logged" value={stats.totalMarks} accent="text-emerald-600 dark:text-emerald-400" />
        <StatTile label="active days" value={stats.activeDays} />
        <StatTile label="current streak" value={<span className="inline-flex items-center gap-1">{stats.currentStreak}<Flame className="h-4 w-4 text-orange-500" /></span>} />
        <StatTile label="longest streak" value={stats.longestStreak} />
        <StatTile label="present rate" value={`${presentRate}%`} accent="text-orange-600 dark:text-orange-400" />
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          {/* month labels */}
          <div className="flex gap-[3px]" aria-hidden>
            {monthLabels.map((m, i) => (
              <span key={i} className="w-[13px] shrink-0 text-[9px] font-bold text-muted-foreground">{m}</span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {/* weekday labels column */}
            <div className="mr-0.5 flex flex-col gap-[3px]" aria-hidden>
              {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
                <span key={i} className="h-[13px] text-[9px] font-bold leading-[13px] text-muted-foreground">{d}</span>
              ))}
            </div>
            {/* heatmap */}
            {cols.map((col, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {col.map((d) => (
                  <span
                    key={d.iso}
                    title={dayTitle(d, d.iso === localToday)}
                    className={`h-[13px] w-[13px] shrink-0 rounded-[3px] ${TIER_CLS[d.tier]} ${d.iso === localToday ? "ring-2 ring-orange-500 ring-offset-1 ring-offset-background" : ""} ${d.iso > localToday ? "opacity-0" : ""}`}
                  />
                ))}
              </div>
            ))}
            {/* legend */}
            <div className="ml-2 flex items-end gap-[3px]" aria-hidden>
              <span className="mr-0.5 text-[9px] font-bold text-muted-foreground">Less</span>
              {TIER_CLS.map((c, i) => <span key={i} className={`h-[13px] w-[13px] rounded-[3px] ${c}`} />)}
              <span className="ml-0.5 text-[9px] font-bold text-muted-foreground">More</span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Last {weeks} weeks of attendance logging — each square is a day, darker = more of the day&apos;s classes marked. Hover a square for details.
      </p>
    </section>
  );
}
