"use client";
// Today view: the working day — mark slots, advice chips, bulk tools.
import { useState } from "react";
import { ChevronLeft, ChevronRight, Check, X, Ban, Copy, Umbrella, Plus, Trash2, Repeat } from "lucide-react";
import { useAttendMate } from "@/lib/attendmate/storage";
import {
  MASTER_TIMETABLE, SUBJECTS, SUBJECT_MAP, Slot,
} from "@/lib/attendmate/data";
import {
  todayISO, shiftDate, getDayName, formatDisplayDate, getDayOfWeek,
  computeSubjectStats, classifySkipPriority, getClinicalPostingForDate,
  getGroupInfo, daySummary,
} from "@/lib/attendmate/engine";
import { TierPill, statusChip } from "../bits";

export default function TodayView() {
  const { state, setState, markSlot, bulkMarkDay, copyPreviousDay, addExtraClass, removeSlot, bulkFill } = useAttendMate();
  const iso = state.selectedDate;
  const subGroup = getGroupInfo(state.profile.rollNo).subGroup;
  const sum = daySummary(state, iso);
  const dow = getDayOfWeek(iso);
  const slots: Slot[] = dow !== 0 ? (MASTER_TIMETABLE[dow] || []) : [];
  const stats = computeSubjectStats(state);
  const customIds = Object.keys(state.logs[iso] || {}).filter((id) => id.startsWith("x-"));
  const posting = getClinicalPostingForDate(iso, subGroup);
  const [fillFrom, setFillFrom] = useState(shiftDate(todayISO(), -7));
  const [fillTo, setFillTo] = useState(shiftDate(todayISO(), -1));
  const [fillStatus, setFillStatus] = useState<"present" | "absent">("present");
  const [extraSub, setExtraSub] = useState("IM");
  const [extraKind, setExtraKind] = useState<"theory" | "clinical">("theory");

  /* hero helpers: greeting + Mon–Sun week strip around the selected date */
  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const firstName = (state.profile.name || "doctor").trim().split(" ")[0];
  const monday = shiftDate(iso, -((dow + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dIso = shiftDate(monday, i);
    return { iso: dIso, label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], num: new Date(`${dIso}T00:00:00`).getDate() };
  });
  const ringFrac = sum.pct === null ? 0 : Math.min(sum.pct, 100) / 100;
  const RING_C = 2 * Math.PI * 19;
  const ringStroke =
    sum.pct === null ? "rgba(255,255,255,0.75)"
      : sum.pct >= state.profile.theoryTarget ? "#34d399"
        : sum.pct >= state.profile.theoryTarget - 15 ? "#fbbf24"
          : "#fb7185";

  const adviceFor = (slot: Slot) => {
    const code = slot.id.endsWith("-cp") ? (posting?.code || "CP") : slot.subject;
    const st = stats[code];
    if (!st || code === "CP") return null;
    const target = state.subjMode === "clinical" ? state.profile.clinicalTarget : state.profile.theoryTarget;
    const m = state.subjMode;
    const pr = m === "clinical" ? st.clinical.present : st.theory.present;
    const tt = m === "clinical" ? st.clinical.total : st.theory.total;
    return classifySkipPriority(SUBJECT_MAP[code], pr, tt, target, m);
  };

  return (
    <div className="space-y-5">
      {/* hero header — gradient spotlight card */}
      <section className="am-card-in relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-violet-700 to-fuchsia-600 p-4 text-white shadow-xl shadow-violet-600/25 sm:p-5">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/4 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <button onClick={() => setState((p) => ({ ...p, selectedDate: shiftDate(iso, -1) }))} aria-label="Previous day"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-white/15 transition hover:bg-white/30"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setState((p) => ({ ...p, selectedDate: shiftDate(iso, 1) }))} aria-label="Next day"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-white/15 transition hover:bg-white/30"><ChevronRight className="h-4 w-4" /></button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-extrabold tracking-tight">{getDayName(iso)}</h2>
              <span className="text-sm font-semibold text-white/75">{formatDisplayDate(iso)}</span>
              {iso === todayISO() && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold tracking-wide">TODAY</span>}
            </div>
            <p className="mt-0.5 text-xs font-medium text-white/70">
              {greeting}, {firstName} — {iso === todayISO() ? "here's your day" : `viewing ${getDayName(iso)}'s schedule`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {iso !== todayISO() && (
              <button onClick={() => setState((p) => ({ ...p, selectedDate: todayISO() }))}
                className="rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-xs font-bold transition hover:bg-white/30">Today</button>
            )}
            <div className="relative h-14 w-14 shrink-0">
              <svg viewBox="0 0 48 48" className="h-14 w-14 -rotate-90">
                <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
                <circle cx="24" cy="24" r="19" fill="none" stroke={ringStroke} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${ringFrac * RING_C} ${RING_C}`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[12px] font-extrabold">
                {sum.pct === null ? "—" : `${sum.pct.toFixed(0)}%`}
              </div>
            </div>
          </div>
        </div>
        {dow === 0 ? (
          <div className="relative mt-4 rounded-xl border border-dashed border-white/30 bg-white/10 p-3 text-center text-sm font-semibold text-white/85">
            Sunday — weekly holiday, nothing scheduled 🌙
          </div>
        ) : (
          <div className="relative mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-white/15 px-2.5 py-1">{sum.present} present</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1">{sum.absent} absent</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1">{sum.cancelled} cancelled</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1">{sum.unlogged} unlogged</span>
          </div>
        )}
      </section>

      {/* week strip — Mon…Sun quick jump */}
      <div className="am-card-in flex gap-1.5 overflow-x-auto pb-1 [animation-delay:60ms] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {weekDays.map((d) => {
          const active = d.iso === iso;
          const wsum = daySummary(state, d.iso);
          const logged = wsum.present + wsum.absent + wsum.cancelled > 0;
          return (
            <button key={d.iso} onClick={() => setState((p) => ({ ...p, selectedDate: d.iso }))}
              aria-label={`Go to ${formatDisplayDate(d.iso)}`}
              className={`flex min-w-[50px] flex-1 flex-col items-center gap-0.5 rounded-2xl border px-2 py-2 transition ${
                active ? "border-violet-500 bg-gradient-to-b from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-600/30"
                  : "border-border bg-card text-muted-foreground hover:border-violet-400 hover:text-violet-600"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide">{d.label}</span>
              <span className="text-[14px] font-extrabold leading-none">{d.num}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${logged ? (active ? "bg-white" : "bg-emerald-500") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      {dow !== 0 && (
        <>
          {/* actions */}
          <div className="am-card-in flex flex-wrap gap-2 [animation-delay:120ms]">
            <button onClick={() => bulkMarkDay(iso, "present", subGroup)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-[13px] font-bold text-white shadow-md shadow-violet-600/30 transition hover:brightness-110">
              <Check className="h-4 w-4" /> Mark all present
            </button>
            <button onClick={() => copyPreviousDay(iso)}
              className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-4 py-2.5 text-[13px] font-bold text-muted-foreground transition hover:text-violet-600">
              <Copy className="h-4 w-4" /> Copy previous day
            </button>
            <button onClick={() => bulkMarkDay(iso, "cancelled")}
              className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-4 py-2.5 text-[13px] font-bold text-muted-foreground transition hover:text-amber-600">
              <Umbrella className="h-4 w-4" /> Declare holiday
            </button>
          </div>

          {/* slot list */}
          <section className="am-card-in divide-y overflow-hidden rounded-2xl border bg-card shadow-sm [animation-delay:180ms]">
            {slots.map((slot) => {
              const entry = state.logs[iso]?.[slot.id];
              const st = entry?.status;
              const isCP = slot.id.endsWith("-cp");
              const credited = entry?.subject || (isCP ? posting?.code : slot.subject);
              const advice = adviceFor(slot);
              const subjMeta = credited && credited !== "CP" ? SUBJECT_MAP[credited] : null;
              return (
                <div key={slot.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition hover:bg-muted/50 sm:px-5">
                  <div className="w-[110px] shrink-0">
                    <div className="text-[13px] font-bold">{slot.time}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{slot.type}</div>
                  </div>
                  <div className="min-w-0 flex-1 basis-52">
                    <div className="flex items-center gap-2">
                      {subjMeta && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subjMeta.color }} />}
                      <span className="truncate text-[13.5px] font-semibold">{isCP ? `Clinical Posting — ${posting ? `${posting.name} (${posting.code})` : "No posting"}` : slot.label}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {statusChip(st)}
                      {advice && <TierPill tier={advice.tier}>{advice.pill}</TierPill>}
                      {isCP && posting && <span className="text-[10.5px] text-muted-foreground">{posting.block} · till {formatDisplayDate(posting.end)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isCP && (
                      <select
                        value={credited || "CP"}
                        onChange={(e) => markSlot(iso, slot.id, st || "present", e.target.value === "CP" ? "CP" : e.target.value, "clinical")}
                        aria-label="Credit department"
                        className="rounded-lg border bg-background px-2 py-1.5 text-[11px] font-bold outline-none"
                      >
                        <option value="CP">CP</option>
                        {SUBJECTS.filter((s) => s.clinicalWeeks > 0).map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
                      </select>
                    )}
                    {!isCP && slot.altSubject && (
                      <select
                        value={credited || slot.subject}
                        onChange={(e) => markSlot(iso, slot.id, st || "present", e.target.value, "theory")}
                        aria-label="Credit subject"
                        className="rounded-lg border bg-background px-2 py-1.5 text-[11px] font-bold outline-none"
                      >
                        <option value={slot.subject}>{slot.subject}</option>
                        <option value={slot.altSubject}>{slot.altSubject}</option>
                      </select>
                    )}
                    {(["present", "absent", "cancelled"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => markSlot(iso, slot.id, s, isCP ? (posting?.code || "CP") : slot.subject, slot.type)}
                        aria-label={`Mark ${s}`}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                          st === s
                            ? s === "present" ? "border-emerald-500 bg-emerald-500 text-white" : s === "absent" ? "border-rose-500 bg-rose-500 text-white" : "border-slate-400 bg-slate-400 text-white"
                            : "bg-background text-muted-foreground hover:border-violet-500 hover:text-violet-600"
                        }`}
                      >
                        {s === "present" ? <Check className="h-4 w-4" /> : s === "absent" ? <X className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* custom extra classes logged on this date */}
            {customIds.map((id) => {
              const e = state.logs[iso][id];
              const meta = e.subject ? SUBJECT_MAP[e.subject] : null;
              return (
                <div key={id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/50 sm:px-5">
                  <div className="w-[110px] shrink-0 text-[13px] font-bold text-violet-600 dark:text-violet-300">EXTRA</div>
                  <div className="min-w-0 flex-1 text-[13.5px] font-semibold">
                    {meta ? meta.name : e.subject} <span className="text-xs text-muted-foreground">({e.kind})</span>
                  </div>
                  {statusChip(e.status)}
                  <button onClick={() => removeSlot(iso, id)} aria-label="Remove extra class"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
          </section>

          {/* tools */}
          <div className="am-card-in grid gap-4 lg:grid-cols-2 [animation-delay:240ms]">
            <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
              <h3 className="flex items-center gap-2 text-[14px] font-extrabold"><Repeat className="h-4 w-4 text-violet-600" /> Bulk-fill past days</h3>
              <p className="mt-1 text-xs text-muted-foreground">Marks whole past date range (skips Sundays and already-logged days). CP credits resolve from your official roster.</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-[11px] font-semibold text-muted-foreground">From
                  <input type="date" value={fillFrom} max={todayISO()} onChange={(e) => setFillFrom(e.target.value)}
                    className="mt-1 block rounded-xl border bg-background px-3 py-2 text-[12.5px] font-bold outline-none focus:border-violet-500" />
                </label>
                <label className="text-[11px] font-semibold text-muted-foreground">To
                  <input type="date" value={fillTo} max={todayISO()} onChange={(e) => setFillTo(e.target.value)}
                    className="mt-1 block rounded-xl border bg-background px-3 py-2 text-[12.5px] font-bold outline-none focus:border-violet-500" />
                </label>
                <label className="text-[11px] font-semibold text-muted-foreground">Status
                  <select value={fillStatus} onChange={(e) => setFillStatus(e.target.value as "present" | "absent")}
                    className="mt-1 block rounded-xl border bg-background px-3 py-2 text-[12.5px] font-bold outline-none focus:border-violet-500">
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                </label>
                <button onClick={() => fillFrom <= fillTo && bulkFill(fillFrom, fillTo, fillStatus, subGroup)}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-[12.5px] font-bold text-white shadow-md shadow-violet-600/30 transition hover:brightness-110">
                  Apply
                </button>
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
              <h3 className="flex items-center gap-2 text-[14px] font-extrabold"><Plus className="h-4 w-4 text-violet-600" /> Add extra / make-up class</h3>
              <p className="mt-1 text-xs text-muted-foreground">Unplanned lecture or posting held beyond the timetable — logs under the chosen subject and mode.</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-[11px] font-semibold text-muted-foreground">Subject
                  <select value={extraSub} onChange={(e) => setExtraSub(e.target.value)}
                    className="mt-1 block max-w-[220px] rounded-xl border bg-background px-3 py-2 text-[12.5px] font-bold outline-none focus:border-violet-500">
                    {SUBJECTS.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-muted-foreground">Mode
                  <select value={extraKind} onChange={(e) => setExtraKind(e.target.value as "theory" | "clinical")}
                    className="mt-1 block rounded-xl border bg-background px-3 py-2 text-[12.5px] font-bold outline-none focus:border-violet-500">
                    <option value="theory">Theory</option>
                    <option value="clinical">Clinical</option>
                  </select>
                </label>
                <button onClick={() => addExtraClass(iso, extraSub, extraKind)}
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-[12.5px] font-bold text-white shadow-md shadow-violet-600/30 transition hover:brightness-110">
                  Add class
                </button>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
