"use client";
// AttendMate Pro — shared UI bits: brand, hash router, rings, sparkline, cards.
import { useEffect, useState, ReactNode } from "react";
import { GraduationCap } from "lucide-react";
import { formatShortDate } from "@/lib/attendmate/engine";

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-orange-600 to-rose-500 text-white shadow-lg shadow-orange-500/30"
      style={{ width: size, height: size }}
    >
      <GraduationCap style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.2} />
    </span>
  );
}

export function BrandWord({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <span className="font-extrabold tracking-tight text-[15px]">
        AttendMate&nbsp;<span className="bg-gradient-to-r from-orange-600 to-rose-500 bg-clip-text text-transparent">Pro</span>
      </span>
    </span>
  );
}

/* ---------- hash router (single route — views via hash) ---------- */
export function useHashRoute(): [string, (to: string) => void] {
  const [route, setRoute] = useState("");
  useEffect(() => {
    const read = () => setRoute((window.location.hash || "").replace(/^#\/?/, ""));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const nav = (to: string) => {
    window.location.hash = to ? `#/${to}` : "/";
    window.scrollTo({ top: 0 });
  };
  return [route, nav];
}

/* ---------- progress ring ---------- */
export function Ring({ pct, target, size = 92, stroke = 9, label }: {
  pct: number | null; target?: number; size?: number; stroke?: number; label?: string;
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct ?? 0));
  const off = C * (1 - p / 100);
  const color = pct === null ? "#94a3b8" : pct >= (target ?? 0) ? "#10b981" : pct >= (target ?? 0) - 7.5 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-muted" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={C.toFixed(1)} strokeDashoffset={off.toFixed(1)} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <b className="leading-none" style={{ fontSize: size * 0.2 }}>{pct === null ? "—" : `${pct.toFixed(1)}%`}</b>
        {label && <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

/* ---------- sparkline (trend) ---------- */
export function Sparkline({ points, target, height = 180 }: { points: { date: string; pct: number }[]; target: number; height?: number }) {
  if (points.length === 0) {
    return <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">Log a few days to see your trend.</div>;
  }
  const W = 560, H = height, padL = 34, padR = 10, padT = 12, padB = 22;
  const iw = W - padL - padR, ih = H - padT - padB;
  const x = (i: number) => padL + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (p: number) => padT + ih - (Math.max(0, Math.min(100, p)) / 100) * ih;
  const path = points.map((pt, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pt.pct).toFixed(1)}`).join(" ");
  const ty = y(target);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Attendance trend">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} className="stroke-border" strokeDasharray={g === 0 || g === 100 ? "" : "3 4"} />
          <text x={4} y={y(g) + 4} fontSize="10" className="fill-muted-foreground">{g}%</text>
        </g>
      ))}
      <line x1={padL} x2={W - padR} y1={ty} y2={ty} className="stroke-rose-500" strokeDasharray="5 4" />
      <text x={padL + 4} y={ty - 4} fontSize="10" className="fill-rose-500">target {target}%</text>
      <path d={path} fill="none" className="stroke-orange-500 dark:stroke-orange-400" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((pt, i) => <circle key={pt.date} cx={x(i)} cy={y(pt.pct)} r="3.2" className="fill-background stroke-orange-500 dark:stroke-orange-400" strokeWidth="2" />)}
      <text x={padL} y={H - 6} fontSize="10" className="fill-muted-foreground">{points[0] ? formatShortDate(points[0].date) : ""}</text>
      <text x={W - padR} y={H - 6} fontSize="10" textAnchor="end" className="fill-muted-foreground">{points[points.length - 1] ? formatShortDate(points[points.length - 1].date) : ""}</text>
    </svg>
  );
}

/* ---------- stat card ---------- */
export function StatCard({ value, label, accent }: { value: ReactNode; label: string; accent?: string }) {
  return (
    <div className="clay-card p-4">
      <div className="border-l-[3px] pl-3" style={{ borderColor: accent || "rgb(249 115 22)" }}>
        <div className="text-2xl font-extrabold tracking-tight leading-none">{value}</div>
        <div className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function TierPill({ tier, children }: { tier: "dont" | "careful" | "safe"; children: ReactNode }) {
  const cls = tier === "dont"
    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
    : tier === "careful"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${cls}`}>{children}</span>;
}

export function statusChip(status: string | undefined) {
  if (status === "present") return <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">PRESENT</span>;
  if (status === "absent") return <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">ABSENT</span>;
  if (status === "cancelled") return <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-500">CANCELLED</span>;
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">UNLOGGED</span>;
}
