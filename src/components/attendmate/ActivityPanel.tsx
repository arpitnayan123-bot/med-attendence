"use client";
// "Your work, at a glance" — identity strip + LeetCode-style stat tiles at
// the top of the Today view, computed on-device from the user's own logs.
// The old mini heatmap was cut (the Calendar tab owns the day-by-day view).
import { Flame, HardDrive, Activity, Fingerprint, BadgeCheck } from "lucide-react";
import { ReactNode } from "react";
import { AppState } from "@/lib/attendmate/data";
import { getGroupInfo } from "@/lib/attendmate/engine";
import { computeActivityStats } from "@/lib/attendmate/activity";

function StatTile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="flex-1 min-w-[104px] rounded-2xl border bg-card/70 px-3 py-2.5 text-center">
      <div className={`text-lg font-extrabold leading-none ${accent || "text-foreground"}`}>{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export default function ActivityPanel({ state, authed }: { state: AppState; authed: boolean }) {
  const weeks = 18;
  // React Compiler memoizes these from `state`; no manual useMemo needed.
  const stats = computeActivityStats(state, weeks);

  const presentRate = stats.totalMarks > 0 ? Math.round((stats.totalPresent / stats.totalMarks) * 100) : 0;
  const gi = getGroupInfo(state.profile.rollNo);
  const firstName = (state.profile.name || "Student").trim().split(" ")[0];
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <section className="clay-card p-5" aria-label="Your activity">
      {/* student identity — the "unique roll" claim is only shown when a real
          server session answered this boot/login; device-only profiles make no
          uniqueness promise (two devices can claim the same roll offline) */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-gradient-to-r from-orange-500/10 via-rose-500/5 to-transparent px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-sm font-extrabold text-white shadow-md shadow-orange-500/30">
          {initial}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 text-[13px] leading-tight">
            <span className="font-extrabold">{state.profile.name || "Student"}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-extrabold text-orange-600 dark:text-orange-400">
              <Fingerprint className="h-3 w-3" /> Roll No. {state.profile.rollNo}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            Group {gi.group} · Sub-group {gi.subGroup}{authed ? " · unique across the batch — no one else holds this roll" : " · resolved on this device"}
          </div>
        </div>
        {authed && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <BadgeCheck className="h-3 w-3" /> verified at sign-up
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
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

</section>
  );
}
