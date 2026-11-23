// AttendMate Pro — pure engine: dates, roll resolution, postings, bunk math, stats.
// Faithful port of the original single-file logic.
import {
  AppState, MASTER_TIMETABLE, MINOR_ROSTER, MID_ROSTER, MAJOR_ROSTER, EXAM_CLINICAL_ROSTER,
  SUBJECTS, SUBJECT_MAP, SUBGROUP_RANGES, SESSION_END, SlotEntry, MarkStatus, Subject, EXAMS,
} from "./data";

/* ---------- dates ---------- */
export function parseISO(iso: string): Date {
  const p = iso.split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function formatDisplayDate(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function formatShortDate(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
export function getDayName(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-IN", { weekday: "long" });
}
export function getDayOfWeek(iso: string): number {
  return parseISO(iso).getDay();
}
export function shiftDate(iso: string, delta: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function daysBetween(isoA: string, isoB: string): number {
  return Math.round((parseISO(isoB).getTime() - parseISO(isoA).getTime()) / 86400000);
}

/* ---------- roll / group / postings ---------- */
export interface GroupInfo { rollNo: number; group: string; subGroup: string }
export function getGroupInfo(rollNo: number): GroupInfo {
  const r = Math.max(1, Math.min(100, Math.floor(Number(rollNo) || 1)));
  const found = SUBGROUP_RANGES.find((it) => r >= it.min && r <= it.max) || SUBGROUP_RANGES[0];
  return { rollNo: r, group: found.group, subGroup: found.sub };
}

export interface Posting { code: string; name: string; start: string; end: string; block: string }
export function getClinicalPostingForDate(isoDate: string, subGroup: string): Posting | null {
  const group = subGroup.charAt(0);
  for (const row of MINOR_ROSTER) {
    if (isoDate >= row.start && isoDate <= row.end) {
      for (const dept of ["DR", "RD", "AN", "PS"]) {
        if ((row[dept] as string[]).includes(subGroup))
          return { code: dept, name: SUBJECT_MAP[dept].name, start: row.start, end: row.end, block: "Allied Specialty" };
      }
    }
  }
  for (const row of MID_ROSTER) {
    if (isoDate >= row.start && isoDate <= row.end) {
      for (const dept of ["PE", "OR", "EN", "OP"]) {
        if ((row[dept] as string[]).includes(subGroup))
          return { code: dept, name: SUBJECT_MAP[dept].name, start: row.start, end: row.end, block: "Specialty Rotation" };
      }
    }
  }
  for (const row of MAJOR_ROSTER) {
    if (isoDate >= row.start && isoDate <= row.end) {
      for (const dept of ["IM", "SU", "OG"]) {
        if ((row[dept] as string[]).includes(group))
          return { code: dept, name: SUBJECT_MAP[dept].name, start: row.start, end: row.end, block: "Major Clinical" };
      }
    }
  }
  for (const row of EXAM_CLINICAL_ROSTER) {
    if (isoDate >= row.start && isoDate <= row.end) {
      for (const dept of ["IM", "SU", "OG"]) {
        if ((row[dept] as string[]).includes(group))
          return { code: dept, name: `${SUBJECT_MAP[dept].name} (Exam Oriented)`, start: row.start, end: row.end, block: "Exam Oriented" };
      }
    }
  }
  return null;
}

export interface TimelineItem { code: string; name: string; start: string; end: string; block: string }
export function getPersonalRosterTimeline(subGroup: string): TimelineItem[] {
  const group = subGroup.charAt(0);
  const list: TimelineItem[] = [];
  for (const row of MINOR_ROSTER) for (const dept of ["DR", "RD", "AN", "PS"])
    if ((row[dept] as string[]).includes(subGroup))
      list.push({ code: dept, name: SUBJECT_MAP[dept].name, start: row.start, end: row.end, block: "Allied (2 wks)" });
  for (const row of MID_ROSTER) for (const dept of ["PE", "OR", "EN", "OP"])
    if ((row[dept] as string[]).includes(subGroup))
      list.push({ code: dept, name: SUBJECT_MAP[dept].name, start: row.start, end: row.end, block: "Specialty" });
  for (const row of MAJOR_ROSTER) for (const dept of ["IM", "SU", "OG"])
    if ((row[dept] as string[]).includes(group))
      list.push({ code: dept, name: SUBJECT_MAP[dept].name, start: row.start, end: row.end, block: "Major Clinical" });
  for (const row of EXAM_CLINICAL_ROSTER) for (const dept of ["IM", "SU", "OG"])
    if ((row[dept] as string[]).includes(group))
      list.push({ code: dept, name: `${SUBJECT_MAP[dept].name} (Exam Oriented)`, start: row.start, end: row.end, block: "Exam Oriented" });
  list.sort((a, b) => a.start.localeCompare(b.start));
  return list;
}

/* ---------- stats ---------- */
export interface ModeStats { present: number; total: number }
export type SubjectStats = Record<string, { theory: ModeStats; clinical: ModeStats }>;
export function computeSubjectStats(state: AppState): SubjectStats {
  const stats: SubjectStats = {};
  for (const s of SUBJECTS) {
    const b = state.baseline[s.code] || {};
    stats[s.code] = {
      theory: { present: Number(b.theoryPresent) || 0, total: Number(b.theoryTotal) || 0 },
      clinical: { present: Number(b.clinicalPresent) || 0, total: Number(b.clinicalTotal) || 0 },
    };
  }
  for (const dateStr of Object.keys(state.logs)) {
    const dayLog = state.logs[dateStr];
    if (!dayLog) continue;
    for (const slotId of Object.keys(dayLog)) {
      const entry = dayLog[slotId];
      if (!entry || !entry.status || entry.status === "cancelled") continue;
      const code = entry.subject;
      if (!code || !stats[code]) continue;
      const isClinical = slotId.endsWith("-cp") || entry.kind === "clinical";
      if (isClinical) {
        stats[code].clinical.total += 1;
        if (entry.status === "present") stats[code].clinical.present += 1;
      } else {
        stats[code].theory.total += 1;
        if (entry.status === "present") stats[code].theory.present += 1;
      }
    }
  }
  return stats;
}

export interface BunkInfo { pct: number | null; status: "empty" | "safe" | "borderline" | "danger"; message: string; canBunk: number; mustAttend: number }
export function calcBunkInfo(present: number, total: number, targetPct: number): BunkInfo {
  if (total <= 0) return { pct: null, status: "empty", message: "No classes logged yet", canBunk: 0, mustAttend: 0 };
  const pct = (present / total) * 100;
  const t = targetPct / 100;
  if (pct >= targetPct) {
    const canBunk = Math.floor((present - t * total) / t);
    const status: BunkInfo["status"] = canBunk >= 2 ? "safe" : "borderline";
    const message = canBunk > 0
      ? `Can safely skip ${canBunk} next ${canBunk === 1 ? "class" : "classes"}`
      : "On target — avoid skipping next class";
    return { pct, status, message, canBunk, mustAttend: 0 };
  }
  const denom = 1 - t;
  const mustAttend = denom > 0 ? Math.ceil((t * total - present) / denom) : 0;
  return { pct, status: "danger", message: `Attend next ${mustAttend} ${mustAttend === 1 ? "class" : "classes"} to hit ${targetPct}%`, canBunk: 0, mustAttend };
}

export interface SkipPriority { tier: "dont" | "careful" | "safe"; pill: string; reason: string }
export function classifySkipPriority(subj: Subject, present: number, total: number, targetPct: number, mode: "theory" | "clinical"): SkipPriority {
  const bunk = calcBunkInfo(present, total, targetPct);
  const isLowFreq = mode === "clinical" ? subj.clinicalWeeks <= 3 : subj.weeklySlots <= 1;
  const isHighFreq = mode === "clinical" ? subj.clinicalWeeks >= 10 : subj.weeklySlots >= 5;
  const dropOnOneMiss = total > 0 ? ((present / total) - (present / (total + 1))) * 100 : 0;

  if (total === 0) {
    if (isLowFreq) return {
      tier: "dont", pill: "Don't Miss",
      reason: mode === "clinical"
        ? `Short ${subj.clinicalWeeks}-wk posting — every day counts`
        : `Only ${subj.weeklySlots}/wk (${subj.lecture}L hrs) — very little margin`,
    };
    if (isHighFreq) return {
      tier: "safe", pill: "High-Freq Buffer",
      reason: mode === "clinical"
        ? `${subj.clinicalWeeks}-wk major posting — log counts to see exact skips`
        : `${subj.weeklySlots} classes/wk (${subj.total} hrs) — highest skip flexibility`,
    };
    return {
      tier: "careful", pill: "Moderate",
      reason: mode === "clinical"
        ? `${subj.clinicalWeeks}-wk posting — log counts to see exact skips`
        : `${subj.weeklySlots} classes/wk — limited cushion`,
    };
  }
  if (bunk.status === "danger" || bunk.canBunk === 0) return {
    tier: "dont", pill: "Don't Miss",
    reason: bunk.status === "danger"
      ? `${bunk.pct!.toFixed(1)}% · Attend next ${bunk.mustAttend} to hit ${targetPct}%`
      : `${bunk.pct!.toFixed(1)}% · 0 skips left (1 miss drops -${dropOnOneMiss.toFixed(1)}%)`,
  };
  if (isLowFreq && bunk.canBunk <= 2) return {
    tier: "dont", pill: "Low-Freq Risk",
    reason: `${bunk.pct!.toFixed(1)}% · Only ${bunk.canBunk} skip left (${subj.weeklySlots}/wk, -${dropOnOneMiss.toFixed(1)}%/miss)`,
  };
  if (bunk.canBunk <= 2) return {
    tier: "careful", pill: `Tight (${bunk.canBunk} left)`,
    reason: `${bunk.pct!.toFixed(1)}% · Max ${bunk.canBunk} safe ${bunk.canBunk === 1 ? "skip" : "skips"} (-${dropOnOneMiss.toFixed(1)}%/miss)`,
  };
  return {
    tier: "safe", pill: `Can Skip ${bunk.canBunk}`,
    reason: `${bunk.pct!.toFixed(1)}% · Can safely skip ${bunk.canBunk} ${bunk.canBunk === 1 ? "class" : "classes"} (-${dropOnOneMiss.toFixed(1)}%/miss)`,
  };
}

export interface Overall { tP: number; tT: number; cP: number; cT: number; wP: number; wT: number }
/* Contact-hour weights for COMBINED figures only: a clinical posting is a
   3-hour block, a theory slot is 1 hour. Per-subject theory/clinical
   percentages stay unweighted (they are per-mode and already correct). */
export const THEORY_WEIGHT = 1;
export const CLINICAL_WEIGHT = 3;
export function overallStats(state: AppState): Overall {
  const stats = computeSubjectStats(state);
  let tP = 0, tT = 0, cP = 0, cT = 0;
  for (const s of SUBJECTS) {
    tP += stats[s.code].theory.present; tT += stats[s.code].theory.total;
    cP += stats[s.code].clinical.present; cT += stats[s.code].clinical.total;
  }
  return { tP, tT, cP, cT, wP: tP + cP * CLINICAL_WEIGHT, wT: tT + cT * CLINICAL_WEIGHT };
}

export interface DaySummary {
  present: number; absent: number; cancelled: number; unlogged: number;
  logged: number; judged: number; totalSlots: number;
  pct: number | null; isHoliday: boolean; dow: number;
  slotIds: string[];
}
export function daySummary(state: AppState, iso: string): DaySummary {
  const dayLog = state.logs[iso];
  let present = 0, absent = 0, cancelled = 0, unlogged = 0;
  const dow = getDayOfWeek(iso);
  const slots = dow !== 0 ? (MASTER_TIMETABLE[dow] || []) : [];
  const custom = dayLog ? Object.keys(dayLog).filter((id) => id.startsWith("x-")) : [];
  const slotIds = [...slots.map((s) => s.id), ...custom];
  const totalSlots = slotIds.length;
  const countFor = (st: MarkStatus | undefined) => {
    if (!st) unlogged++;
    else if (st === "present") present++;
    else if (st === "absent") absent++;
    else cancelled++;
  };
  for (const s of slots) countFor(dayLog && dayLog[s.id] && dayLog[s.id].status);
  for (const id of custom) countFor(dayLog[id].status);
  const logged = present + absent + cancelled;
  const judged = present + absent;
  return {
    present, absent, cancelled, unlogged, logged, judged, totalSlots,
    pct: judged > 0 ? (present / judged) * 100 : null,
    isHoliday: totalSlots > 0 && cancelled === totalSlots, dow, slotIds,
  };
}

export function slotEntryFor(state: AppState, iso: string, slotId: string, subGroup: string): SlotEntry | undefined {
  const existing = state.logs[iso]?.[slotId];
  if (existing) return existing;
  if (!slotId.endsWith("-cp")) return undefined;
  const posting = getClinicalPostingForDate(iso, subGroup);
  if (posting) return { status: "present", subject: posting.code, kind: "clinical", custom: false };
  return undefined;
}

export interface StreakInfo { best: number; current: number; perfectDays: number; totalLoggedDays: number }
export function streakInfo(state: AppState): StreakInfo {
  const dates = Object.keys(state.logs).sort();
  const isPerfect = (iso: string) => { const d = daySummary(state, iso); return d.judged > 0 && d.absent === 0; };
  let best = 0, cur = 0;
  for (const iso of dates) {
    if (isPerfect(iso)) { cur++; best = Math.max(best, cur); } else cur = 0;
  }
  let curStreak = 0;
  let probe = todayISO();
  if (!(state.logs[probe] && daySummary(state, probe).judged > 0)) probe = shiftDate(probe, -1);
  while (state.logs[probe] && isPerfect(probe)) {
    curStreak++;
    probe = shiftDate(probe, -1);
    // Sundays are structurally logless (no scheduled classes): treat them as
    // neutral so Sat→Mon perfect days stay one continuous streak — `best`
    // already behaves this way because it iterates logged dates only.
    while (getDayOfWeek(probe) === 0 && daySummary(state, probe).judged === 0) {
      probe = shiftDate(probe, -1);
    }
  }
  const perfectDays = dates.filter(isPerfect).length;
  return { best, current: curStreak, perfectDays, totalLoggedDays: dates.length };
}

/**
 * Projection horizon. Sentup ends 24 Dec 2027, but the exam-oriented clinical
 * blocks keep running to 8 Jan 2028 (see EXAM_CLINICAL_ROSTER) — so the real
 * session end is the later of the two. Derived from the data, never hard-coded.
 */
export const PROJECTION_HORIZON: string = [SESSION_END, ...EXAM_CLINICAL_ROSTER.map((r) => r.end)].reduce((a, b) => (b > a ? b : a));

export function scheduledRemaining(state: AppState, todayIso: string): { remT: number; remC: number } {
  // Slot counts per weekday come from the master timetable — never literals.
  const perDow: Record<number, { t: number; c: number }> = {};
  for (let dow = 0; dow <= 6; dow++) {
    const slots = MASTER_TIMETABLE[dow] || [];
    perDow[dow] = {
      t: slots.filter((s) => s.type !== "clinical").length,
      c: slots.filter((s) => s.type === "clinical").length,
    };
  }
  // No regular classes inside assessment windows (internal assessments + Sentup).
  const exams = examDates();
  let remT = 0, remC = 0;
  let d = todayIso;
  while (d <= PROJECTION_HORIZON) {
    const dow = getDayOfWeek(d);
    // Sundays are holidays; a user-declared holiday is a logged day (all
    // slots cancelled), already excluded by the logs check below.
    if (dow !== 0 && !state.logs[d] && !exams.has(d)) {
      remT += perDow[dow].t;
      remC += perDow[dow].c;
    }
    d = shiftDate(d, 1);
  }
  return { remT, remC };
}

export interface Projection { theory: number | null; clinical: number | null; combined: number | null; remT: number; remC: number; horizon: string }
export function projectSessionEnd(state: AppState): Projection {
  const { tP, tT, cP, cT } = overallStats(state);
  const { remT, remC } = scheduledRemaining(state, todayISO());
  // A projection needs an actual observed rate: with zero logged classes the
  // old fallback assumed a 100% future, showing a brand-new profile 100.0%.
  // Null instead — the ring renders "—" until a week of real data exists.
  const proj = (p: number, t: number, rem: number): number | null => {
    if (t === 0) return null;
    return ((p + (p / t) * rem) / (t + rem)) * 100;
  };
  const theory = proj(tP, tT, remT);
  const clinical = proj(cP, cT, remC);
  // Combined needs both modes observed — a missing side would fabricate its
  // rate. Contact-hour weighted: theory slots count 1, posting days count 3.
  const combined = tT === 0 || cT === 0
    ? null
    : ((tP + (tP / tT) * remT) + CLINICAL_WEIGHT * (cP + (cP / cT) * remC))
      / ((tT + remT) + CLINICAL_WEIGHT * (cT + remC)) * 100;
  return { theory, clinical, combined, remT, remC, horizon: PROJECTION_HORIZON };
}

export interface TrendPoint { date: string; pct: number }
export function trendSeries(state: AppState, n = 15): TrendPoint[] {
  const dates = Object.keys(state.logs).sort();
  const out: TrendPoint[] = [];
  for (const iso of dates.slice(-n)) {
    const d = daySummary(state, iso);
    if (d.pct !== null) out.push({ date: iso, pct: d.pct });
  }
  return out;
}

export function weekdayAverages(state: AppState): { dow: number; avg: number | null; count: number }[] {
  const buckets: Record<number, { sum: number; n: number }> = {};
  for (const iso of Object.keys(state.logs)) {
    const d = daySummary(state, iso);
    if (d.pct === null) continue;
    if (!buckets[d.dow]) buckets[d.dow] = { sum: 0, n: 0 };
    buckets[d.dow].sum += d.pct;
    buckets[d.dow].n += 1;
  }
  const names = [1, 2, 3, 4, 5, 6];
  return names.map((dow) => ({
    dow,
    avg: buckets[dow] && buckets[dow].n > 0 ? buckets[dow].sum / buckets[dow].n : null,
    count: buckets[dow] ? buckets[dow].n : 0,
  }));
}

export function pctColorClass(pct: number | null, target: number): string {
  if (pct === null) return "text-muted-foreground";
  if (pct >= target) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= target - 7.5) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}
export function pctStroke(pct: number | null, target: number): string {
  if (pct === null) return "#94a3b8";
  if (pct >= target) return "#10b981";
  if (pct >= target - 7.5) return "#f59e0b";
  return "#f43f5e";
}

export interface CalendarCell { date: string | null; pct: number | null; logged: boolean; isHoliday: boolean; exam: boolean; dow: number }
export function monthMatrix(state: AppState, year: number, month: number): CalendarCell[] {
  const examSet = examDates();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push({ date: null, pct: null, logged: false, isHoliday: false, exam: false, dow: 0 });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const sum = daySummary(state, iso);
    cells.push({
      date: iso, pct: sum.pct, logged: sum.logged > 0, isHoliday: sum.isHoliday,
      exam: examSet.has(iso), dow: (first.getDay() + d - 1) % 7,
    });
  }
  return cells;
}
export function examDates(): Set<string> {
  const set = new Set<string>();
  for (const e of EXAMS) {
    let d = e.start;
    while (d <= e.end) { set.add(d); d = shiftDate(d, 1); }
  }
  return set;
}
