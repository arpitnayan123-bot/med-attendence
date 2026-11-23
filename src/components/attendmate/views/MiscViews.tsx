"use client";
// Timetable · Postings · Exams · Modules · Settings views.
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, History, LogOut, RotateCcw, Upload, Stethoscope, CalendarClock } from "lucide-react";
import { listOwnerSnapshots, OwnerSnapshot } from "@/lib/attendmate/device-storage";
import { useAttendMate } from "@/lib/attendmate/storage";
import {
  MASTER_TIMETABLE, SUBJECT_MAP, AETCOM_MODULES, PANDEMIC_MODULES, EXAMS,
} from "@/lib/attendmate/data";
import {
  todayISO, getGroupInfo, getClinicalPostingForDate, getPersonalRosterTimeline,
  formatDisplayDate, daysBetween,
} from "@/lib/attendmate/engine";
import { apiSecurity } from "@/lib/attendmate/sync";
import SecuritySection, { StorageCard } from "./Security";

/* ================= TIMETABLE ================= */
export function TimetableView() {
  const { state } = useAttendMate();
  const subGroup = getGroupInfo(state.profile.rollNo).subGroup;
  const days = [1, 2, 3, 4, 5, 6];
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const rows = ["09", "cp", "14", "15", "16"];
  const rowTime = (slotId: string) => {
    for (const d of days) { const s = (MASTER_TIMETABLE[d] || []).find((x) => x.id.endsWith(slotId === "cp" ? "-cp" : `-${slotId}`)); if (s) return s.time; }
    return "";
  };

  return (
    <div className="space-y-5">
      <section className="clay-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-extrabold">Master weekly timetable</h2>
          <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-300">Sub-group {subGroup}</span>
          <span className="ml-auto text-[11px] font-semibold text-muted-foreground">20 theory hrs · 18 clinical hrs per week</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="w-24 rounded-tl-xl bg-muted p-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Time</th>
                {dayNames.map((d) => <th key={d} className="bg-muted p-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r}>
                  <td className="border-t bg-muted/40 p-2.5 text-[11px] font-bold text-muted-foreground">{rowTime(r)}</td>
                  {days.map((d) => {
                    const slot = (MASTER_TIMETABLE[d] || [])[ri];
                    if (!slot) return <td key={d} className="border-t p-1.5" />;
                    const isCP = slot.type === "clinical";
                    const posting = isCP ? getClinicalPostingForDate(todayISO(), subGroup) : null;
                    const meta = isCP ? null : SUBJECT_MAP[slot.subject];
                    return (
                      <td key={d} className="border-t p-1.5">
                        <div className="rounded-lg border px-2.5 py-2"
                          style={meta ? { borderColor: `${meta.color}55`, background: `${meta.color}14` } : { borderColor: "rgb(249 115 22 / .35)", background: "rgb(249 115 22 / .08)" }}>
                          <div className="font-bold">{isCP ? `CP — ${posting ? posting.code : "—"}` : slot.subject}</div>
                          <div className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground" title={slot.label}>
                            {isCP ? (posting ? posting.name : "Clinical Posting") : meta?.name}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          PS/DR (Tue 09) and RD/AN (Wed 14) alternate weekly in the official schedule — mark the slot, then credit either subject. The 10 AM – 1 PM posting credits the department your sub-group is rotating through.
        </p>
      </section>
    </div>
  );
}

/* ================= POSTINGS ================= */
export function PostingsView() {
  const { state } = useAttendMate();
  const subGroup = getGroupInfo(state.profile.rollNo).subGroup;
  const timeline = useMemo(() => getPersonalRosterTimeline(subGroup), [subGroup]);
  const today = todayISO();
  const current = getClinicalPostingForDate(today, subGroup);
  const past = timeline.filter((r) => r.end < today);
  const upcoming = timeline.filter((r) => r.start > today);
  const daysLeft = current ? daysBetween(today, current.end) : null;
  const totalDays = current ? daysBetween(current.start, current.end) + 1 : null;

  return (
    <div className="space-y-5">
      {current ? (
        <section className="clay-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-300"><Stethoscope className="h-5 w-5" /></span>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Current rotation</div>
              <h2 className="text-lg font-extrabold">{current.name} ({current.code})</h2>
            </div>
            <span className="ml-auto rounded-full bg-orange-500/10 px-3 py-1.5 text-[11.5px] font-bold text-orange-600 dark:text-orange-300">{current.block}</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500"
                style={{ width: `${totalDays ? Math.min(100, Math.max(0, ((totalDays - (daysLeft || 0)) / totalDays) * 100)) : 0}%` }} />
            </div>
            <span className="text-[12px] font-bold">{daysLeft !== null && daysLeft >= 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "ends today"}</span>
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">{formatDisplayDate(current.start)} → {formatDisplayDate(current.end)} · your 10 AM – 1 PM posting credits {current.code}</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed bg-card p-5 text-center text-sm text-muted-foreground">
          No rotation scheduled for today — check the timeline below.
        </section>
      )}

      <section className="clay-card overflow-hidden">
        <div className="border-b bg-muted/40 px-5 py-3 text-[13px] font-extrabold">Full posting timeline — Sub-group {subGroup}</div>
        <div className="max-h-[420px] overflow-y-auto">
          {timeline.map((r) => {
            const status = r.end < today ? "past" : r.start <= today ? "current" : "upcoming";
            return (
              <div key={`${r.code}-${r.start}`} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-[12.5px] ${status === "current" ? "bg-orange-500/5" : ""}`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${status === "past" ? "bg-muted-foreground/30" : status === "current" ? "bg-orange-500" : "bg-emerald-500"}`} />
                <span className={`font-semibold ${status === "past" ? "text-muted-foreground" : ""}`}>{r.name} <span className="text-muted-foreground">({r.code})</span></span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{r.block}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{formatDisplayDate(r.start)} → {formatDisplayDate(r.end)}</span>
              </div>
            );
          })}
        </div>
        <div className="border-t bg-muted/20 px-5 py-2.5 text-[11px] text-muted-foreground">{past.length} completed · {timeline.length - past.length - upcoming.length} current · {upcoming.length} upcoming</div>
      </section>
    </div>
  );
}

/* ================= EXAMS ================= */
export function ExamsView() {
  const today = todayISO();
  return (
    <div className="space-y-4">
      <section className="clay-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold"><CalendarClock className="h-4 w-4 text-orange-600 dark:text-orange-300" /> Assessment calendar 2026–28</h2>
        <p className="mt-1 text-xs text-muted-foreground">Official internal assessments and the pre-university exam. Assessment windows appear dashed on the calendar.</p>
      </section>
      {EXAMS.map((e) => {
        const daysTo = daysBetween(today, e.start);
        const happening = today >= e.start && today <= e.end;
        const done = today > e.end;
        return (
          <section key={e.id} className={`clay-card p-4 sm:p-5 ${happening ? "outline-2 outline-offset-[-2px] outline-rose-500/50" : ""}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h3 className="text-[14.5px] font-extrabold">{e.name}</h3>
                <p className="mt-0.5 max-w-xl text-[12px] text-muted-foreground">{e.subjects}</p>
              </div>
              <span className={`ml-auto rounded-full px-3 py-1.5 text-[11.5px] font-bold ${
                happening ? "bg-rose-500 text-white shadow-md shadow-rose-500/30" : done ? "bg-muted text-muted-foreground" : "bg-orange-500/10 text-orange-600 dark:text-orange-300"
              }`}>
                {happening ? "HAPPENING NOW" : done ? "COMPLETED" : `T−${daysTo} DAYS`}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
              <span className="font-semibold">{formatDisplayDate(e.start)} → {formatDisplayDate(e.end)}</span>
              <span className="text-muted-foreground">{daysBetween(e.start, e.end) + 1} days · week {Math.ceil((daysBetween("2026-10-10", e.start) + 1) / 7)} of session</span>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ================= MODULES ================= */
export function ModulesView() {
  const { state, setState } = useAttendMate();
  const aetcomDone = AETCOM_MODULES.filter((m) => state.aetcomDone[m.id]).length;
  const panDone = PANDEMIC_MODULES.filter((m) => state.pandemicDone[m.id]).length;

  const section = (title: string, mods: typeof AETCOM_MODULES, done: number, doneMap: Record<string, boolean>, key: "aetcomDone" | "pandemicDone") => (
    <section className="clay-card overflow-hidden">
      <div className="border-b bg-muted/40 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h3 className="text-[13.5px] font-extrabold">{title}</h3>
          <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-300">{done}/{mods.length} done</span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500" style={{ width: `${(done / mods.length) * 100}%` }} />
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {mods.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-start gap-3 border-b px-5 py-3 last:border-b-0 hover:bg-muted/30">
            <input
              type="checkbox"
              checked={Boolean(doneMap[m.id])}
              onChange={(e) => setState((p) => ({ ...p, [key]: { ...p[key], [m.id]: e.target.checked } }), "Toggle module")}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-orange-500"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[12.5px] font-bold ${doneMap[m.id] ? "text-muted-foreground line-through" : ""}`}>{m.title}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-bold text-muted-foreground">{m.hours}</span>
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-orange-600 dark:text-orange-300">{m.dept}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{m.topic}</p>
            </div>
          </label>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-5">
      {section("AETCOM Module — Foundation Course (Phase-III)", AETCOM_MODULES, aetcomDone, state.aetcomDone, "aetcomDone")}
      {section("Pandemic Management Module", PANDEMIC_MODULES, panDone, state.pandemicDone, "pandemicDone")}
    </div>
  );
}

/* ================= SETTINGS ================= */
export function SettingsView() {
  const { state, setState, resetAll, importState, setTheme, authed, signOut } = useAttendMate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetPw, setResetPw] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const snaps = useMemo(() => listOwnerSnapshots(state.syncOwnerId ?? null), [state.syncOwnerId]);
  const [form, setForm] = useState({
    name: state.profile.name, email: state.profile.email, rollNo: String(state.profile.rollNo),
    theoryTarget: String(state.profile.theoryTarget), clinicalTarget: String(state.profile.clinicalTarget),
  });

  // Reset-all needs a step-up: ask for the authenticator code only when 2FA is on.
  useEffect(() => {
    if (!authed) return;
    apiSecurity().then((s) => setTotpEnabled(s.totpEnabled)).catch(() => { /* offline */ });
  }, [authed]);


  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendmate-pro-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Backup downloaded — keep it safe.");
  };

  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importState(String(reader.result));
      setMsg(ok ? "Backup imported successfully — syncing to your account." : "That file doesn't look like an AttendMate Pro backup.");
    };
    reader.readAsText(file);
  };

  const signOutEverywhere = async () => {
    await signOut();
    setState((p) => ({ ...p, profile: { ...p.profile, name: "", email: "", rollNo: 1 } }), "Sign out");
    window.location.hash = "/";
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="clay-card p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-extrabold">Account &amp; privacy</h2>
          {authed ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Signed in · data stays on this device
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">Device only — no account</span>
          )}
        </div>
        <p className="mt-1.5 max-w-[70ch] text-xs text-muted-foreground">
          {authed
            ? "Your account exists only to prove who you are (password + 2FA) and to lock your device store to you on shared browsers. Every record — attendance, subjects, modules, targets — is stored on this device and is never uploaded. Moving to a new device? Export a backup file here and import it there."
            : "Everything lives in this browser only — nothing is transmitted or uploaded. Create an account from the sign-in page if you want password-protected access on shared devices; your data still never leaves this device."}
        </p>
      </section>

      <section className="clay-card p-5">
        <h2 className="text-[15px] font-extrabold">Profile</h2>
        <p className="text-xs text-muted-foreground">Stored on this device only — the server never sees it.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-[11px] font-semibold text-muted-foreground">Full name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="clay-input mt-1 w-full px-3.5 py-2.5 text-[13px]" />
          </label>
          <label className="block text-[11px] font-semibold text-muted-foreground">Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="clay-input mt-1 w-full px-3.5 py-2.5 text-[13px]" />
          </label>
          <label className="block text-[11px] font-semibold text-muted-foreground">Roll number (1–100)
            <input type="number" min={1} max={100} value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })}
              className="clay-input mt-1 w-32 px-3.5 py-2.5 text-[13px]" />
          </label>
          <button
            onClick={() => setState((p) => ({ ...p, profile: { ...p.profile, name: form.name.trim() || p.profile.name, email: form.email.trim() || p.profile.email, rollNo: Math.max(1, Math.min(100, parseInt(form.rollNo, 10) || p.profile.rollNo)) } }), "Update profile")}
            className="clay-btn clay-primary clay-md"
          >Save profile</button>
        </div>
      </section>

      <section className="clay-card p-5">
        <h2 className="text-[15px] font-extrabold">Attendance targets</h2>
        <p className="text-xs text-muted-foreground">College rules are 75% theory / 80% clinical — customise if your department says otherwise.</p>
        <div className="mt-4 flex items-end gap-3">
          <label className="text-[11px] font-semibold text-muted-foreground">Theory %
            <input type="number" min={1} max={100} value={form.theoryTarget} onChange={(e) => setForm({ ...form, theoryTarget: e.target.value })}
              className="clay-input mt-1 w-24 px-3.5 py-2.5 text-[13px]" />
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">Clinical %
            <input type="number" min={1} max={100} value={form.clinicalTarget} onChange={(e) => setForm({ ...form, clinicalTarget: e.target.value })}
              className="clay-input mt-1 w-24 px-3.5 py-2.5 text-[13px]" />
          </label>
          <button
            onClick={() => setState((p) => ({ ...p, profile: { ...p.profile, theoryTarget: Math.max(1, Math.min(100, parseInt(form.theoryTarget, 10) || 75)), clinicalTarget: Math.max(1, Math.min(100, parseInt(form.clinicalTarget, 10) || 80)) } }), "Update targets")}
            className="clay-btn clay-primary clay-md"
          >Save targets</button>
        </div>

        <h3 className="mt-6 text-[13px] font-extrabold">Appearance</h3>
        <div className="mt-2 inline-flex rounded-xl border bg-muted/60 p-1">
          {(["light", "dark"] as const).map((th) => (
            <button key={th} onClick={() => setTheme(th)}
              className={`rounded-lg px-4 py-1.5 text-[12px] font-bold capitalize ${state.profile.theme === th ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{th}</button>
          ))}
        </div>
      </section>

      <StorageCard />
      {authed && <SecuritySection />}

      <section className="clay-card p-5 lg:col-span-2">
        <h2 className="text-[15px] font-extrabold">Data — backup &amp; recovery</h2>
        <p className="text-xs text-muted-foreground">Everything lives in localStorage. Export regularly; import on a new device to restore.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={exportBackup} className="clay-btn clay-soft clay-md">
            <Download className="h-4 w-4" /> Export backup
          </button>
          <button onClick={() => fileRef.current?.click()} className="clay-btn clay-soft clay-md">
            <Upload className="h-4 w-4" /> Import backup
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" aria-hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ""; }} />
          {confirmReset ? (
            <span className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/50 bg-rose-500/5 px-3 py-2 text-[12px] font-bold text-rose-600 dark:text-rose-300">
              Erase all data{authed ? " (device + server)" : ""}?
              {authed && (
                <>
                  <input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Confirm password" autoComplete="current-password"
                    className="clay-input w-44 px-3 py-2 text-[12px]" />
                  {authed && totpEnabled && (
                    <input value={resetCode} onChange={(e) => setResetCode(e.target.value)} placeholder="Code" inputMode="numeric"
                      className="clay-input w-24 px-3 py-2 text-[12px]" />
                  )}
                </>
              )}
              <button
                disabled={resetBusy || (authed && !resetPw) || (authed && totpEnabled && resetCode.length < 6)}
                onClick={() => {
                  setResetBusy(true);
                  resetAll(authed ? { password: resetPw, code: authed && totpEnabled ? resetCode : undefined } : undefined)
                    .then(() => { setMsg("All data erased."); setConfirmReset(false); setResetPw(""); setResetCode(""); })
                    .catch((e: Error) => setMsg(e.message || "Reset failed — nothing was erased."))
                    .finally(() => setResetBusy(false));
                }}
                className="clay-btn clay-danger clay-sm rounded-[0.7rem]"
              >{resetBusy ? "Erasing…" : "Yes, erase"}</button>
              <button onClick={() => { setConfirmReset(false); setResetPw(""); setResetCode(""); }} className="clay-btn clay-soft clay-sm rounded-[0.7rem]">Cancel</button>
            </span>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="clay-btn clay-danger clay-md">
              <RotateCcw className="h-4 w-4" /> Reset all data
            </button>
          )}
          <button onClick={() => void signOutEverywhere()} className="clay-btn clay-soft clay-md">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
        {snaps.length > 0 && (
          <div className="mt-4 border-t border-dashed pt-3">
            <p className="text-[11px] font-semibold text-muted-foreground">
              Device snapshots — automatic daily copies of this profile&apos;s data, kept on this device only.
              Restoring replaces the current data with the snapshot.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {snaps.map((s) => (
                <button key={s.dayKey}
                  onClick={() => {
                    const ok = importState(JSON.stringify(s.state));
                    setMsg(ok ? `Snapshot ${s.dayKey} restored.` : "That snapshot couldn't be restored.");
                  }}
                  className="clay-btn clay-soft clay-sm">
                  <History className="h-3.5 w-3.5" /> Restore {s.dayKey}
                </button>
              ))}
            </div>
          </div>
        )}
        {msg && <p className="mt-3 rounded-xl border border-dashed p-2.5 text-[12px] font-semibold">{msg}</p>}
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          AttendMate Pro is an unofficial, student-built tool — not affiliated with NSMCH or Aryabhatta Knowledge University.
          Dates and rosters follow the published Phase-III (Part-2) schedule; the college&apos;s word always wins.
        </p>
      </section>
    </div>
  );
}
