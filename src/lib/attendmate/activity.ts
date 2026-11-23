// Activity analytics — the "contribution graph" engine (GitHub/LeetCode style).
// Pure functions over AppState.logs + the master timetable: heat tiers,
// streaks and totals, all computed on-device from the user's own logs.
import { AppState, MASTER_TIMETABLE } from "./data";

export interface ActivityDay {
  iso: string;
  scheduled: number; // master-timetable slots for that weekday (0 on Sunday)
  marked: number; // slots the user actually logged
  present: number;
  tier: 0 | 1 | 2 | 3 | 4; // heatmap intensity (0 = empty)
}

export interface ActivityStats {
  totalMarks: number;
  totalPresent: number;
  activeDays: number; // days with ≥1 mark, all-time
  currentStreak: number; // consecutive logged non-Sunday days (ends today/yesterday)
  longestStreak: number;
  weeks: number; // heatmap window
}

/** Master-timetable slots scheduled on a weekday (Sunday = holiday → 0). */
export function scheduledSlots(dow: number): number {
  return dow === 0 ? 0 : (MASTER_TIMETABLE[dow]?.length ?? 0);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(iso: string): Date {
  return new Date(`${iso}T12:00:00`); // noon avoids DST edges
}
function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
function dowOf(iso: string): number {
  return parseISO(iso).getDay();
}

/** Heat tier from how much of the scheduled day the user logged (extra classes cap at 4). */
function tierFor(marked: number, scheduled: number): ActivityDay["tier"] {
  if (marked === 0) return 0;
  const r = marked / Math.max(scheduled, marked);
  if (r >= 1) return 4;
  if (r >= 0.67) return 3;
  if (r >= 0.34) return 2;
  return 1;
}

/** Day record for any date (Sunday extra-class sessions still count). */
export function activityFor(state: AppState, iso: string): ActivityDay {
  const dow = dowOf(iso);
  const scheduled = scheduledSlots(dow);
  const dayLog = state.logs[iso] || {};
  const entries = Object.values(dayLog);
  const marked = entries.length;
  const present = entries.filter((e) => e?.status === "present").length;
  return { iso, scheduled, marked, present, tier: tierFor(marked, scheduled) };
}

/**
 * Weeks-aligned heatmap window ending in the current week, exactly like
 * GitHub's contribution graph: columns = weeks (Sun..Sat), last column ends
 * today. `weeks` back-filled columns of 7 days each.
 */
export function buildHeatmapWeeks(state: AppState, weeks = 18): ActivityDay[][] {
  const today = isoDate(new Date());
  // Sunday of the current week is the last column; walk back `weeks` columns.
  let cursor = addDays(today, -dowOf(today)); // Sunday, current week
  cursor = addDays(cursor, -((weeks - 1) * 7));
  const cols: ActivityDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: ActivityDay[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = addDays(cursor, d);
      // days after today stay empty placeholders
      col.push(iso > today ? { iso, scheduled: scheduledSlots(dowOf(iso)), marked: 0, present: 0, tier: 0 } : activityFor(state, iso));
    }
    cols.push(col);
    cursor = addDays(cursor, 7);
  }
  return cols;
}

/**
 * LeetCode-style totals. Streaks treat Sunday as neutral (nothing is ever
 * scheduled) so Sat→Mon logging stays a continuous streak, mirroring how
 * GitHub ignores days with no expected activity.
 */
export function computeActivityStats(state: AppState, weeks = 18): ActivityStats {
  const dates = Object.keys(state.logs).filter((d) => Object.keys(state.logs[d] || {}).length > 0);
  let totalMarks = 0;
  let totalPresent = 0;
  for (const d of dates) {
    const entries = Object.values(state.logs[d] || {});
    totalMarks += entries.length;
    totalPresent += entries.filter((e) => e?.status === "present").length;
  }

  // longest run of marked non-Sunday days — walk day-by-day so Sundays are
  // neutral (Sat→Mon stays continuous)
  const sorted = [...dates].sort();
  let longest = 0;
  let run = 0;
  if (sorted.length > 0) {
    const today0 = isoDate(new Date());
    let d = sorted[0];
    while (d <= today0) {
      const dow = dowOf(d);
      const markedDay = Object.keys(state.logs[d] || {}).length > 0;
      if (dow === 0) { /* Sunday: neutral, neither breaks nor extends */ }
      else if (markedDay) { run += 1; longest = Math.max(longest, run); }
      else run = 0;
      d = addDays(d, 1);
    }
  }

  // current streak: walk back from today; today may be unmarked without breaking
  const today = isoDate(new Date());
  let cur = 0;
  let probe = today;
  if (Object.keys(state.logs[today] || {}).length === 0) probe = addDays(today, -1); // grace: today not yet marked
  while (true) {
    const dow = dowOf(probe);
    if (dow === 0) { probe = addDays(probe, -1); continue; }
    if (Object.keys(state.logs[probe] || {}).length > 0) {
      cur += 1;
      probe = addDays(probe, -1);
    } else break;
  }

  return {
    totalMarks,
    totalPresent,
    activeDays: dates.length,
    currentStreak: cur,
    longestStreak: longest,
    weeks,
  };
}
