"use client";
// Landing page = sign-in. Originkit "Dither Reveal" animation fills the
// screen on a dark background; a minimal glass sign-in card sits on top.
import { useState } from "react";
import { ArrowRight, GraduationCap, Loader2 } from "lucide-react";
import DitherReveal from "@/components/originkit/ui/dither-reveal";
import { BrandWord } from "./bits";
import { useAttendMate } from "@/lib/attendmate/storage";
import { getGroupInfo } from "@/lib/attendmate/engine";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn({ onDone, nav }: { onDone: () => void; nav: (to: string) => void }) {
  const { state, setState } = useAttendMate();
  const [step, setStep] = useState<"email" | "profile">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState(state.profile.name || "");
  const [roll, setRoll] = useState<string>(state.profile.rollNo > 1 ? String(state.profile.rollNo) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submitEmail = () => {
    if (!EMAIL_RE.test(email)) { setErr("Enter a valid email address"); return; }
    setErr("");
    setBusy(true);
    setTimeout(() => { setBusy(false); setStep("profile"); }, 450); // Google-style brief pause
  };

  const submitProfile = () => {
    const n = name.trim();
    const r = parseInt(roll, 10);
    if (!n) { setErr("Enter your name"); return; }
    if (!(r >= 1 && r <= 100)) { setErr("Roll number must be between 1 and 100"); return; }
    setErr("");
    const gi = getGroupInfo(r);
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, name: n, email: email.trim(), rollNo: gi.rollNo },
    }));
    setBusy(true);
    setTimeout(onDone, 350);
  };

  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* Originkit Dither Reveal — full-screen animation */}
      <div className="absolute inset-0">
        <DitherReveal
          image={{ src: "/originkit/reveal.jpg", alt: "Doctor portrait" }}
          ditherStyle="bayer8"
          dotSize={5}
          revealRadius={150}
          revealSoftness={55}
          wave
          waveSpeed={82}
          waveDensity={25}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/25 to-black/80" aria-hidden />

      {/* minimal chrome */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <BrandWord size={34} />
          <span className="hidden rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur sm:inline-flex">
            NSMCH Bihta · Phase-III (Part-2) · 2026–27
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-[400px] rounded-3xl border border-white/15 bg-black/45 p-7 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:p-8">
            {step === "email" ? (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10">
                    <GraduationCap className="h-6 w-6" />
                  </span>
                  <h1 className="text-[22px] font-bold tracking-tight">Sign in</h1>
                  <p className="mt-1.5 text-[13px] text-white/60">to continue to AttendMate Pro</p>
                </div>
                <label className="mb-1 block text-xs font-semibold text-white/70" htmlFor="lm-email">Email</label>
                <input
                  id="lm-email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitEmail()}
                  placeholder="you@gmail.com"
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-violet-400/70 focus:bg-white/15"
                />
                {err && <p className="mt-2 text-xs font-medium text-rose-400">{err}</p>}
                <button
                  onClick={submitEmail}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-[14px] font-bold shadow-lg shadow-violet-600/40 transition hover:brightness-110 active:scale-[.99]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Next <ArrowRight className="h-4 w-4" /></>}
                </button>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/45">
                  <span>English (India)</span>
                  <span>Help · Privacy · Terms</span>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-lg font-bold">
                    {email.trim().charAt(0).toUpperCase()}
                  </span>
                  <h1 className="text-[20px] font-bold tracking-tight">{email}</h1>
                  <p className="mt-1.5 text-[13px] text-white/60">Create your local dashboard profile</p>
                </div>
                <label className="mb-1 block text-xs font-semibold text-white/70" htmlFor="lm-name">Full name</label>
                <input
                  id="lm-name"
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitProfile()}
                  placeholder="e.g. Arjun Kumar"
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-violet-400/70 focus:bg-white/15"
                />
                <label className="mb-1 mt-4 block text-xs font-semibold text-white/70" htmlFor="lm-roll">Roll number <span className="font-normal text-white/45">· 1–100</span></label>
                <input
                  id="lm-roll"
                  type="number"
                  min={1}
                  max={100}
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitProfile()}
                  placeholder="e.g. 23"
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-violet-400/70 focus:bg-white/15"
                />
                {roll !== "" && parseInt(roll, 10) >= 1 && parseInt(roll, 10) <= 100 && (
                  <p className="mt-2 text-[11px] font-semibold text-violet-300">
                    → Group {getGroupInfo(parseInt(roll, 10)).group} · Sub-group {getGroupInfo(parseInt(roll, 10)).subGroup}
                  </p>
                )}
                {err && <p className="mt-2 text-xs font-medium text-rose-400">{err}</p>}
                <button
                  onClick={submitProfile}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-[14px] font-bold shadow-lg shadow-violet-600/40 transition hover:brightness-110 active:scale-[.99]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create dashboard <ArrowRight className="h-4 w-4" /></>}
                </button>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/45">
                  <button onClick={() => { setStep("email"); setErr(""); }} className="hover:text-white/80">← Change email</button>
                  <span>Stored only on this device</span>
                </div>
              </>
            )}
          </div>
        </main>

        <footer className="flex flex-col items-center gap-2 px-4 pb-5 text-center">
          <nav className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-[12px] font-semibold text-white/60">
            {["features", "how-it-works", "roster", "faq", "about"].map((r, i) => (
              <span key={r} className="flex items-center">
                {i > 0 && <span className="mx-1.5 text-white/25">·</span>}
                <button onClick={() => nav(r)} className="transition hover:text-white">{r === "how-it-works" ? "guide" : r}</button>
              </span>
            ))}
          </nav>
          <p className="text-[11px] text-white/35">Unofficial, offline-first · your data never leaves this device</p>
        </footer>
      </div>
    </div>
  );
}
