"use client";
// Subjects view: tiered priority cards. A row opens a detail dialog (bottom
// sheet on mobile, centered modal on desktop) with the current theory and
// clinical percentages, a what-if simulator (preview only — never touches the
// log) and the prior-record baseline editor.
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, RotateCcw, X } from "lucide-react";
import { useAttendMate } from "@/lib/attendmate/storage";
import { SUBJECTS, Subject } from "@/lib/attendmate/data";
import { computeSubjectStats, calcBunkInfo, classifySkipPriority, getGroupInfo } from "@/lib/attendmate/engine";
import { Ring, TierPill } from "../bits";

export default function SubjectsView() {
  const { state, setState } = useAttendMate();
  const [detail, setDetail] = useState<string | null>(null);
  const stats = useMemo(() => computeSubjectStats(state), [state]);
  const mode = state.subjMode;
  const target = mode === "clinical" ? state.profile.clinicalTarget : state.profile.theoryTarget;
  const subGroup = getGroupInfo(state.profile.rollNo).subGroup;

  const tiered = useMemo(() => {
    type Tiered = Subject & { _pill: string; _reason: string };
    const tiers: Record<"dont" | "careful" | "safe", Tiered[]> = { dont: [], careful: [], safe: [] };
    for (const s of SUBJECTS) {
      const st = stats[s.code];
      const pr = mode === "clinical" ? st.clinical.present : st.theory.present;
      const tt = mode === "clinical" ? st.clinical.total : st.theory.total;
      const pr2 = classifySkipPriority(s, pr, tt, target, mode);
      tiers[pr2.tier].push({ ...s, _pill: pr2.pill, _reason: pr2.reason });
    }
    return tiers;
  }, [stats, mode, target]);

  const tierMeta = {
    dont: { title: "Don't Miss", cls: "text-rose-600 dark:text-rose-300", dot: "bg-rose-500" },
    careful: { title: "Be Careful", cls: "text-amber-600 dark:text-amber-300", dot: "bg-amber-500" },
    safe: { title: "Safe to Miss", cls: "text-emerald-600 dark:text-emerald-300", dot: "bg-emerald-500" },
  } as const;

  const detailSubject = detail ? SUBJECTS.find((s) => s.code === detail) || null : null;

  return (
    <div className="space-y-5">
      {/* mode toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="clay-soft inline-flex rounded-2xl p-1">
          {(["theory", "clinical"] as const).map((m) => (
            <button key={m} onClick={() => setState((p) => ({ ...p, subjMode: m }))}
              className={`rounded-xl px-4 py-2 text-[12.5px] font-bold capitalize transition ${
                mode === m ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/30" : "text-muted-foreground hover:text-foreground"
              }`}>
              {m} · {m === "theory" ? state.profile.theoryTarget : state.profile.clinicalTarget}%
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-muted-foreground">Sub-group {subGroup} · clinical credits resolve from the official roster</span>
      </div>

      {(["dont", "careful", "safe"] as const).map((tier) => (
        tiered[tier].length > 0 && (
          <section key={tier}>
            <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wide">
              <span className={`h-2.5 w-2.5 rounded-full ${tierMeta[tier].dot}`} />
              <span className={tierMeta[tier].cls}>{tierMeta[tier].title}</span>
              <span className="text-muted-foreground">({tiered[tier].length})</span>
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {tiered[tier].map((s) => {
                const st = stats[s.code];
                const pr = mode === "clinical" ? st.clinical.present : st.theory.present;
                const tt = mode === "clinical" ? st.clinical.total : st.theory.total;
                const pct = tt > 0 ? (pr / tt) * 100 : null;
                return (
                  <div key={s.code} className="clay-card transition">
                    <button onClick={() => setDetail(s.code)} className="flex w-full items-center gap-3 p-4 text-left"
                      aria-haspopup="dialog" aria-expanded={detail === s.code}>
                      <Ring pct={pct} target={target} size={64} stroke={7} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                          <span className="truncate text-[14px] font-extrabold">{s.name}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-bold text-muted-foreground">{s.code}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <TierPill tier={tier}>{s._pill}</TierPill>
                          <span className="text-[10.5px] text-muted-foreground">{tt > 0 ? `${pr}/${tt}` : "no data yet"}</span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground" title={s._reason}>{s._reason}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )
      ))}

      {/* detail dialog: bottom sheet on mobile, centered modal on desktop */}
      {detailSubject && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`${detailSubject.name} details`}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setDetail(null)} aria-hidden />
          <div className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
            <SubjectDetail code={detailSubject.code} onClose={() => setDetail(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectDetail({ code, onClose }: { code: string; onClose: () => void }) {
  const { state, setState } = useAttendMate();
  const stats = useMemo(() => computeSubjectStats(state), [state]);
  const s = SUBJECTS.find((x) => x.code === code)!;
  const st = stats[code];
  const mode = state.subjMode;
  const theoryTarget = state.profile.theoryTarget;
  const clinicalTarget = state.profile.clinicalTarget;
  const target = mode === "clinical" ? clinicalTarget : theoryTarget;

  /* preview-only what-if state — { p, t } are preview numbers, never the log */
  const baseP = mode === "clinical" ? st.clinical.present : st.theory.present;
  const baseT = mode === "clinical" ? st.clinical.total : st.theory.total;
  const [sim, setSim] = useState<{ p: number; t: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preview = sim ? calcBunkInfo(sim.p, sim.t, target) : null;

  return (
    <>
      {/* header */}
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-extrabold">{s.name}</h3>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{s.code} · {s.lecture}L hrs theory · {s.clinicalWeeks}-wk posting</p>
        </div>
        <button onClick={onClose} aria-label="Close details" className="clay-btn clay-soft clay-icon h-8 w-8 text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>

      {/* current theory + clinical percentages (both, regardless of mode toggle) */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-center text-[11px] font-semibold text-muted-foreground">
        <div className="rounded-xl bg-muted/60 p-3">
          <div className="text-[13px] font-extrabold text-foreground">Theory</div>
          {st.theory.total > 0 ? `${st.theory.present}/${st.theory.total} · ${((st.theory.present / st.theory.total) * 100).toFixed(1)}%` : "no data"}
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <div className="text-[13px] font-extrabold text-foreground">Clinical</div>
          {st.clinical.total > 0 ? `${st.clinical.present}/${st.clinical.total} · ${((st.clinical.present / st.clinical.total) * 100).toFixed(1)}%` : "no data"}
        </div>
      </div>
      {baseT > 0 && (
        <p className="mt-3 rounded-xl border border-dashed p-2.5 text-center text-[12px] font-semibold">
          {calcBunkInfo(baseP, baseT, target).message}
        </p>
      )}

      {/* what-if simulator — preview numbers only */}
      <div className="mt-4 border-t pt-4">
        <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">What-if simulator</h4>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={() => setSim({ p: baseP + 1, t: baseT + 1 })}
            disabled={sim !== null}
            className="clay-btn clay-sm rounded-[0.7rem] clay-success disabled:opacity-50">+1 attended</button>
          <button onClick={() => setSim({ p: baseP, t: baseT + 1 })}
            disabled={sim !== null}
            className="clay-btn clay-sm rounded-[0.7rem] clay-danger disabled:opacity-50">+1 missed</button>
        </div>
        {sim && preview && (
          <div className="mt-3 rounded-xl border border-dashed border-orange-400/60 bg-orange-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-orange-600 dark:text-orange-300">Preview</span>
              <button onClick={() => setSim(null)} className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground transition hover:text-foreground">
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
            <p className="mt-2 text-[13px] font-extrabold">
              {preview.pct === null ? "—" : `${preview.pct.toFixed(1)}%`}
              <span className="ml-2 text-[11px] font-semibold text-muted-foreground">
                {sim.p}/{sim.t} · {preview.canBunk > 0 ? `can skip ${preview.canBunk}` : preview.mustAttend > 0 ? `must attend ${preview.mustAttend}` : "on target"}
              </span>
            </p>
          </div>
        )}
        {baseT === 0 && <p className="mt-2 text-[11px] text-muted-foreground">Log or baseline a few classes first — the preview starts from your current count.</p>}
      </div>

      {/* prior-record baseline */}
      <BaselineForm code={code} />
    </>
  );
}

function BaselineForm({ code }: { code: string }) {
  const { state, setState } = useAttendMate();
  const b = state.baseline[code] || {};
  const [tp, setTp] = useState(String(b.theoryPresent ?? ""));
  const [tt, setTt] = useState(String(b.theoryTotal ?? ""));
  const [cp, setCp] = useState(String(b.clinicalPresent ?? ""));
  const [ct, setCt] = useState(String(b.clinicalTotal ?? ""));
  const clear = () => {
    setTp(""); setTt(""); setCp(""); setCt("");
    setState((prev) => {
      const next = { ...prev.baseline };
      delete next[code];
      return { ...prev, baseline: next };
    }, "Clear baseline");
  };
  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Prior-record baseline (merged with new logs)</h4>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Theory present", tp, setTp], ["Theory total", tt, setTt],
          ["Clinical present", cp, setCp], ["Clinical total", ct, setCt],
        ].map(([lab, val, setter]) => (
          <label key={lab as string} className="text-[10.5px] font-semibold text-muted-foreground">
            {lab as string}
            <input type="number" min={0} value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              className="clay-input mt-1 w-full px-2.5 py-1.5 text-[12.5px]" />
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setState((prev) => ({
            ...prev,
            baseline: { ...prev.baseline, [code]: {
              theoryPresent: parseInt(tp, 10) || 0, theoryTotal: parseInt(tt, 10) || 0,
              clinicalPresent: parseInt(cp, 10) || 0, clinicalTotal: parseInt(ct, 10) || 0,
            } },
          }), "Update baseline")}
          className="clay-btn clay-primary clay-sm"
        >
          Save baseline
        </button>
        <button onClick={clear} className="clay-btn clay-soft clay-sm">Clear</button>
      </div>
    </div>
  );
}
