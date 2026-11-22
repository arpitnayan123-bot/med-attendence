"use client";
// Subjects view: tiered priority cards with per-subject details, baselines
// and the what-if simulator.
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAttendMate } from "@/lib/attendmate/storage";
import { SUBJECTS, SUBJECT_MAP } from "@/lib/attendmate/data";
import { computeSubjectStats, calcBunkInfo, classifySkipPriority, getGroupInfo } from "@/lib/attendmate/engine";
import { Ring, TierPill } from "../bits";

export default function SubjectsView() {
  const { state, setState } = useAttendMate();
  const [open, setOpen] = useState<string | null>(null);
  const stats = useMemo(() => computeSubjectStats(state), [state]);
  const mode = state.subjMode;
  const target = mode === "clinical" ? state.profile.clinicalTarget : state.profile.theoryTarget;
  const subGroup = getGroupInfo(state.profile.rollNo).subGroup;

  const tiered = useMemo(() => {
    const tiers: Record<"dont" | "careful" | "safe", typeof SUBJECTS> = { dont: [], careful: [], safe: [] };
    for (const s of SUBJECTS) {
      const st = stats[s.code];
      const pr = mode === "clinical" ? st.clinical.present : st.theory.present;
      const tt = mode === "clinical" ? st.clinical.total : st.theory.total;
      const pr2 = classifySkipPriority(s, pr, tt, target, mode);
      tiers[pr2.tier].push({ ...s, _pct: tt > 0 ? (pr / tt) * 100 : null, _pill: pr2.pill, _reason: pr2.reason } as typeof s & { _pct: number | null; _pill: string; _reason: string });
    }
    return tiers;
  }, [stats, mode, target]);

  const tierMeta = {
    dont: { title: "Don't Miss", cls: "text-rose-600 dark:text-rose-300", dot: "bg-rose-500" },
    careful: { title: "Be Careful", cls: "text-amber-600 dark:text-amber-300", dot: "bg-amber-500" },
    safe: { title: "Safe to Miss", cls: "text-emerald-600 dark:text-emerald-300", dot: "bg-emerald-500" },
  } as const;

  return (
    <div className="space-y-5">
      {/* mode toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border bg-card p-1 shadow-sm">
          {(["theory", "clinical"] as const).map((m) => (
            <button key={m} onClick={() => setState((p) => ({ ...p, subjMode: m }))}
              className={`rounded-lg px-4 py-2 text-[12.5px] font-bold capitalize transition ${
                mode === m ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-600/30" : "text-muted-foreground hover:text-foreground"
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
                const bunk = calcBunkInfo(pr, tt, target);
                const isOpen = open === s.code;
                return (
                  <div key={s.code} className="rounded-2xl border bg-card shadow-sm transition hover:shadow-md">
                    <button onClick={() => setOpen(isOpen ? null : s.code)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={isOpen}>
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
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isOpen && (
                      <div className="border-t px-4 py-4">
                        {/* mode totals + bunk */}
                        <div className="grid grid-cols-2 gap-3 text-center text-[11px] font-semibold text-muted-foreground">
                          <div className="rounded-xl bg-muted/60 p-2.5">
                            <div className="text-[13px] font-extrabold text-foreground">Theory</div>
                            {st.theory.total > 0 ? `${st.theory.present}/${st.theory.total} · ${((st.theory.present / st.theory.total) * 100).toFixed(1)}%` : "no data"}
                          </div>
                          <div className="rounded-xl bg-muted/60 p-2.5">
                            <div className="text-[13px] font-extrabold text-foreground">Clinical</div>
                            {st.clinical.total > 0 ? `${st.clinical.present}/${st.clinical.total} · ${((st.clinical.present / st.clinical.total) * 100).toFixed(1)}%` : "no data"}
                          </div>
                        </div>
                        {tt > 0 && (
                          <p className="mt-3 rounded-xl border border-dashed p-2.5 text-center text-[12px] font-semibold">
                            {bunk.message}
                          </p>
                        )}

                        {/* simulator */}
                        <div className="mt-4">
                          <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">What-if simulator (preview only)</h4>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <SimBtn code={s.code} mode={mode} delta={1} target={target} stats={stats} label="+1 attended" good />
                            <SimBtn code={s.code} mode={mode} delta={-1} target={target} stats={stats} label="+1 missed" />
                          </div>
                        </div>

                        {/* baselines */}
                        <BaselineForm code={s.code} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )
      ))}
    </div>
  );
}

function SimBtn({ code, mode, delta, target, stats, label, good }: {
  code: string; mode: "theory" | "clinical"; delta: number; target: number;
  stats: ReturnType<typeof computeSubjectStats>; label: string; good?: boolean;
}) {
  const st = stats[code];
  const baseP = mode === "clinical" ? st.clinical.present : st.theory.present;
  const baseT = mode === "clinical" ? st.clinical.total : st.theory.total;
  if (baseT === 0) return null;
  const np = Math.max(0, baseP + (delta > 0 ? 1 : 0));
  const nt = baseT + 1;
  const pct = (np / nt) * 100;
  const bunk = calcBunkInfo(np, nt, target);
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-[11.5px] font-semibold">
      <button className={`rounded-lg px-2 py-1 text-[11px] font-bold text-white ${good ? "bg-emerald-500" : "bg-rose-500"}`}>{label}</button>
      <span className={pct >= target ? "text-emerald-600 dark:text-emerald-400" : pct >= target - 7.5 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}>
        {pct.toFixed(1)}% · {bunk.canBunk > 0 ? `can skip ${bunk.canBunk}` : `must attend ${bunk.mustAttend}`}
      </span>
    </span>
  );
}

function BaselineForm({ code }: { code: string }) {
  const { state, setState } = useAttendMate();
  const b = state.baseline[code] || {};
  const [tp, setTp] = useState(String(b.theoryPresent ?? ""));
  const [tt, setTt] = useState(String(b.theoryTotal ?? ""));
  const [cp, setCp] = useState(String(b.clinicalPresent ?? ""));
  const [ct, setCt] = useState(String(b.clinicalTotal ?? ""));
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
              className="mt-1 w-full rounded-lg border bg-background px-2.5 py-1.5 text-[12.5px] font-bold outline-none focus:border-violet-500" />
          </label>
        ))}
      </div>
      <button
        onClick={() => setState((prev) => ({
          ...prev,
          baseline: { ...prev.baseline, [code]: {
            theoryPresent: parseInt(tp, 10) || 0, theoryTotal: parseInt(tt, 10) || 0,
            clinicalPresent: parseInt(cp, 10) || 0, clinicalTotal: parseInt(ct, 10) || 0,
          } },
        }), "Update baseline")}
        className="mt-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-[12px] font-bold text-white shadow-md shadow-violet-600/30 transition hover:brightness-110"
      >
        Save baseline
      </button>
    </div>
  );
}
