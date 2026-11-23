"use client";
// Today view: the working day — mark slots, advice chips, bulk tools.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, X, Ban, Copy, Umbrella, Plus, Trash2, Lock } from "lucide-react";
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
import ActivityPanel from "../ActivityPanel";
import FirstRunTips from "../FirstRunTips";

export default function TodayView() {
  const { state, setState, markSlot, unmarkSlot, bulkMarkDay, copyPreviousDay, addExtraClass, removeSlot } = useAttendMate();
  const iso = state.selectedDate;
  const subGroup = getGroupInfo(state.profile.rollNo).subGroup;
  const sum = daySummary(state, iso);
  const dow = getDayOfWeek(iso);
  // Marking is a today-only action: past days are read-only and stay as
  // logged, future days have nothing to mark yet.
  const canMark = iso === todayISO();
  const slots: Slot[] = dow !== 0 ? (MASTER_TIMETABLE[dow] || []) : [];
  const stats = computeSubjectStats(state);
  const customIds = Object.keys(state.logs[iso] || {}).filter((id) => id.startsWith("x-"));
  const posting = getClinicalPostingForDate(iso, subGroup);
  const [extraSub, setExtraSub] = useState("IM");
  const [extraKind, setExtraKind] = useState<"theory" | "clinical">("theory");

  /* midnight rollover: if the app stays open past 00:00 while viewing what was
     "today", follow the calendar to the new day — the old day becomes past and
     locks itself automatically. Any other selected date is left untouched. */
  const wasTodayRef = useRef(iso === todayISO());
  const rolloverDayRef = useRef(todayISO());
  useEffect(() => {
    const snap = () => {
      const now = todayISO();
      if (now !== rolloverDayRef.current && wasTodayRef.current) {
        setState((p) => ({ ...p, selectedDate: now }), "New day");
      }
      wasTodayRef.current = iso === rolloverDayRef.current; // viewing the day that was "today"
      rolloverDayRef.current = now;
    };
    const t = setInterval(snap, 30_000);
    document.addEventListener("visibilitychange", snap);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", snap); };
  }, [iso, setState]);

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
      {/* first-run guide — dismissable; disappears once the user knows the flow */}
      <FirstRunTips />

      {/* activity panel — GitHub/LeetCode-style contribution graph, computed on-device */}
      <ActivityPanel state={state} />

      {/* hero header — warm sunset spotlight card */}
      <section className="am-card-in relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-500 p-4 text-white shadow-xl shadow-orange-600/30 sm:p-5">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/4 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl" />
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
                active ? "border-orange-300 bg-gradient-to-b from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/30"
                  : "border-border bg-card text-muted-foreground hover:border-orange-400 hover:text-orange-600"
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
          {/* day-level marking tools — today only, like the per-slot buttons */}
          {canMark ? (
            <div className="am-card-in flex flex-wrap gap-2 [animation-delay:120ms]">
              <button onClick={() => bulkMarkDay(iso, "present", subGroup)}
                className="clay-btn clay-primary clay-md">
                <Check className="h-4 w-4" /> Mark all present
              </button>
              <button onClick={() => copyPreviousDay(iso)}
                className="clay-btn clay-soft clay-md">
                <Copy className="h-4 w-4" /> Copy previous day
              </button>
              <button onClick={() => bulkMarkDay(iso, "cancelled")}
                className="clay-btn clay-soft clay-md">
                <Umbrella className="h-4 w-4" /> Declare holiday
              </button>
            </div>
          ) : iso < todayISO() && slots.some((s) => !state.logs[iso]?.[s.id]) && (
            /* past day with gaps: keep the log visible but explain the lock and
               point at the one sanctioned way to catch up */
            <div className="am-card-in flex items-center gap-2 rounded-2xl border border-muted bg-muted/40 px-4 py-3 text-[12.5px] text-muted-foreground [animation-delay:120ms]">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>This day has passed — its log is locked as recorded.</span>
            </div>
          )}

          {/* slot list */}
          <section className="clay-card am-card-in divide-y overflow-hidden [animation-delay:180ms]">
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
                      {/* advice is a decision aid — pointless once the slot is decided, and on read-only days */}
                      {canMark && !st && advice && <TierPill tier={advice.tier}>{advice.pill}</TierPill>}
                      {isCP && posting && <span className="text-[10.5px] text-muted-foreground">{posting.block} · till {formatDisplayDate(posting.end)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canMark ? (
                      <>
                        {isCP && (
                          <select
                            value={credited || "CP"}
                            onChange={(e) => markSlot(iso, slot.id, st || "present", e.target.value === "CP" ? "CP" : e.target.value, "clinical")}
                            aria-label="Credit department"
                            className="clay-input rounded-[0.7rem] px-2 py-1.5 text-[11px]"
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
                            className="clay-input rounded-[0.7rem] px-2 py-1.5 text-[11px]"
                          >
                            <option value={slot.subject}>{slot.subject}</option>
                            <option value={slot.altSubject}>{slot.altSubject}</option>
                          </select>
                        )}
                        {(["present", "absent", "cancelled"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => st === s ? unmarkSlot(iso, slot.id) : markSlot(iso, slot.id, s, isCP ? (posting?.code || "CP") : slot.subject, slot.type)}
                            aria-label={st === s ? `Unmark ${s}` : `Mark ${s}`}
                            aria-pressed={st === s}
                            title={st === s ? "Tap again to undo" : undefined}
                            className={`clay-btn h-8 w-8 rounded-[0.7rem] ${
                              st === s
                                ? s === "present" ? "clay-success" : s === "absent" ? "clay-danger" : "bg-gradient-to-b from-slate-400 to-slate-500 text-white shadow-md shadow-slate-500/30"
                                : "clay-soft text-muted-foreground"
                            }`}
                          >
                            {s === "present" ? <Check className="h-4 w-4" /> : s === "absent" ? <X className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </button>
                        ))}
                      </>
                    ) : (
                      !st && <span className="text-[10.5px] font-semibold italic text-muted-foreground">{iso < todayISO() ? "not logged" : "upcoming"}</span>
                    )}
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
                  <div className="w-[110px] shrink-0 text-[13px] font-bold text-orange-600 dark:text-orange-300">EXTRA</div>
                  <div className="min-w-0 flex-1 text-[13.5px] font-semibold">
                    {meta ? meta.name : e.subject} <span className="text-xs text-muted-foreground">({e.kind})</span>
                  </div>
                  {statusChip(e.status)}
                  {canMark && (
                    <button onClick={() => removeSlot(iso, id)} aria-label="Remove extra class"
                      className="clay-btn clay-soft clay-icon h-8 w-8 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              );
            })}
          </section>

          {/* tools — today only: extras and make-up classes are logged the day they happen */}
          {canMark && (
            <section className="clay-card am-card-in p-4 sm:p-5 [animation-delay:240ms]">

              <h3 className="flex items-center gap-2 text-[14px] font-extrabold"><Plus className="h-4 w-4 text-orange-600 dark:text-orange-300" /> Add extra / make-up class</h3>
              <p className="mt-1 text-xs text-muted-foreground">Unplanned lecture or posting held beyond the timetable — logs under the chosen subject and mode.</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-[11px] font-semibold text-muted-foreground">Subject
                  <select value={extraSub} onChange={(e) => setExtraSub(e.target.value)}
                    className="clay-input mt-1 block max-w-[220px] px-3 py-2 text-[12.5px]">
                    {SUBJECTS.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-muted-foreground">Mode
                  <select value={extraKind} onChange={(e) => setExtraKind(e.target.value as "theory" | "clinical")}
                    className="clay-input mt-1 block px-3 py-2 text-[12.5px]">
                    <option value="theory">Theory</option>
                    <option value="clinical">Clinical</option>
                  </select>
                </label>
                <button onClick={() => addExtraClass(iso, extraSub, extraKind)}
                  className="clay-btn clay-primary clay-sm">
                  Add class
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
