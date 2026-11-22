"use client";
// Landing page = sign-in · "Aurora Bento" redesign.
// Animated aurora mesh + film grain + masked grid on near-black; desktop split
// (story panel with product bento + Originkit DitherReveal tile | auth card on
// a glowing panel), mobile-first single column. All motion respects
// prefers-reduced-motion. Accounts: bcrypt + JWT cookie; device-only fallback.
import { useState } from "react";
import {
  ArrowRight, CalendarClock, CloudUpload, Eye, EyeOff, Flame, Loader2,
  Lock, ShieldCheck, Sparkles, WifiOff,
} from "lucide-react";
import DitherReveal from "@/components/originkit/ui/dither-reveal";
import { BrandWord } from "./bits";
import { useAttendMate } from "@/lib/attendmate/storage";
import { apiExists } from "@/lib/attendmate/sync";
import { getGroupInfo } from "@/lib/attendmate/engine";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- backdrop ---------- */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/></filter><rect width='180' height='180' filter='url(%23n)' opacity='0.55'/></svg>\")";

function AuroraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* aurora blobs */}
      <div className="absolute -left-[18%] -top-[22%] h-[58vmax] w-[58vmax] rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.5),rgba(124,58,237,0))] blur-3xl [animation:am-aurora-a_26s_ease-in-out_infinite]" />
      <div className="absolute -right-[22%] top-[2%] h-[52vmax] w-[52vmax] rounded-full bg-[radial-gradient(closest-side,rgba(217,70,239,0.36),rgba(217,70,239,0))] blur-3xl [animation:am-aurora-b_32s_ease-in-out_infinite]" />
      <div className="absolute -bottom-[28%] left-[16%] h-[48vmax] w-[48vmax] rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.26),rgba(16,185,129,0))] blur-3xl [animation:am-aurora-c_38s_ease-in-out_infinite]" />
      {/* masked grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_38%,black_30%,transparent_78%)]" />
      {/* film grain */}
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: GRAIN }} />
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_52%,rgba(5,3,12,0.8)_100%)]" />
    </div>
  );
}

/* ---------- bento mini-cards (decorative, true to the product) ---------- */
function BentoGrid() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 lg:mt-10 lg:gap-4">
      {/* skip advice */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl transition hover:border-violet-400/40 hover:bg-white/[0.08] sm:p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">Skip advice</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-300">Don&apos;t skip</span>
          <span className="text-[13px] font-extrabold text-white">IMM · 84%</span>
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-white/55">3 safe bunks left before the 75% line bites.</p>
      </div>
      {/* clinical ring */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl transition hover:border-emerald-400/40 hover:bg-white/[0.08] sm:p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">Clinical · OR</p>
        <div className="mt-2 flex items-center gap-3">
          <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
            <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
            <circle cx="24" cy="24" r="19" fill="none" stroke="#34d399" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${0.87 * 2 * Math.PI * 19} ${2 * Math.PI * 19}`} />
          </svg>
          <div>
            <p className="text-lg font-extrabold leading-none">87%</p>
            <p className="mt-1 text-[11px] text-white/55">13 / 15 duties</p>
          </div>
        </div>
      </div>
      {/* streak */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl transition hover:border-amber-400/40 hover:bg-white/[0.08] sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">Streak</p>
          <Flame className="am-float h-4 w-4 text-amber-400" />
        </div>
        <p className="mt-2 text-2xl font-extrabold leading-none">18<span className="ml-1 text-[12px] font-bold text-white/55">days perfect</span></p>
        <p className="mt-2 text-[11.5px] text-amber-300/90">+1 today — keep it alive.</p>
      </div>
      {/* offline sync */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl transition hover:border-violet-400/40 hover:bg-white/[0.08] sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">Sync</p>
          <WifiOff className="h-4 w-4 text-violet-300" />
        </div>
        <p className="mt-2 text-[13px] font-extrabold leading-snug">Dead-zone proof</p>
        <p className="mt-2 text-[11.5px] leading-snug text-white/55">Queued offline, synced the moment Wi-Fi returns.</p>
      </div>
      {/* DitherReveal tile */}
      <div className="relative col-span-2 hidden h-44 overflow-hidden rounded-2xl border border-white/10 bg-black sm:block md:h-48">
        <div className="absolute inset-0">
          <DitherReveal
            image={{ src: "/originkit/reveal.jpg", alt: "" }}
            ditherStyle="bayer8"
            dotSize={5}
            revealRadius={150}
            revealSoftness={55}
            wave
            waveSpeed={82}
            waveDensity={25}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
          <span className="rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[10px] font-bold text-white/75 backdrop-blur">
            Originkit · Dither Reveal canvas
          </span>
          <span className="hidden items-center gap-1.5 text-[10px] font-semibold text-white/50 sm:flex">
            <Sparkles className="h-3 w-3" /> move your cursor over it
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- main component ---------- */
export default function SignIn({ onDone, nav }: { onDone: () => void; nav: (to: string) => void }) {
  const { state, setState, signIn, signUp } = useAttendMate();
  const [step, setStep] = useState<"email" | "login" | "register">("email");
  const [deviceOnly, setDeviceOnly] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState(state.profile.name || "");
  const [roll, setRoll] = useState<string>(state.profile.rollNo > 1 ? String(state.profile.rollNo) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const finish = () => {
    setBusy(true);
    setTimeout(onDone, 300);
  };

  const submitEmail = async () => {
    if (!EMAIL_RE.test(email)) { setErr("Enter a valid email address"); return; }
    setErr("");
    setBusy(true);
    try {
      const exists = await apiExists(email.trim().toLowerCase());
      setDeviceOnly(false);
      setStep(exists ? "login" : "register");
    } catch {
      setErr("Can't reach the sync server right now — you can continue on this device only.");
      setDeviceOnly(true);
      setStep("register");
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = async () => {
    if (!password) { setErr("Enter your password"); return; }
    setErr("");
    setBusy(true);
    const r = await signIn(email.trim().toLowerCase(), password);
    setBusy(false);
    if (r.ok) finish();
    else setErr(r.error || "Invalid email or password");
  };

  const submitRegister = async () => {
    const n = name.trim();
    const r = parseInt(roll, 10);
    if (!n) { setErr("Enter your name"); return; }
    if (!(r >= 1 && r <= 100)) { setErr("Roll number must be between 1 and 100"); return; }
    if (!deviceOnly && password.length < 8) { setErr("Password must be at least 8 characters"); return; }
    setErr("");
    setBusy(true);
    if (deviceOnly) {
      setState((prev) => ({ ...prev, profile: { ...prev.profile, name: n, email: email.trim(), rollNo: r } }));
      setBusy(false);
      finish();
      return;
    }
    const res = await signUp(email.trim().toLowerCase(), n, r, password);
    setBusy(false);
    if (res.ok) finish();
    else setErr(res.error || "Registration failed");
  };

  const gi = roll !== "" && parseInt(roll, 10) >= 1 && parseInt(roll, 10) <= 100 ? getGroupInfo(parseInt(roll, 10)) : null;
  const canEnter = step === "email" ? submitEmail : step === "login" ? submitLogin : submitRegister;

  const inputCls =
    "w-full rounded-xl border border-white/15 bg-white/[0.08] px-4 py-3 text-[14px] font-medium text-white placeholder-white/35 outline-none transition focus:border-violet-400/80 focus:bg-white/[0.12] focus:shadow-[0_0_0_4px_rgba(139,92,246,0.18)]";
  const labelCls = "mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/60";

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-[#05030c] text-white antialiased">
      <AuroraBackdrop />

      {/* header */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="am-card-in"><BrandWord size={34} /></div>
        <span className="am-card-in hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[10.5px] font-bold text-white/70 backdrop-blur sm:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Unofficial · student-built · offline-first
        </span>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-8 px-4 pb-8 pt-4 sm:px-6 lg:grid-cols-[1.06fr_0.94fr] lg:gap-10 lg:px-10 lg:pb-14 lg:pt-10">
        {/* story panel */}
        <section className="am-card-in [animation-delay:80ms]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-violet-200">
            <CalendarClock className="h-3.5 w-3.5" /> NSMCH Bihta · Phase-III (Part-2) · 2026–27
          </span>
          <h1 className="mt-4 text-[clamp(2.2rem,7.2vw,3.9rem)] font-extrabold leading-[1.03] tracking-tight lg:mt-6">
            Your attendance,
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-emerald-300 bg-clip-text text-transparent">
              engineered.
            </span>
          </h1>
          <p className="mt-3.5 max-w-[52ch] text-[13.5px] leading-relaxed text-white/60 sm:text-[14.5px]">
            Mark a day in three taps. Know exactly which classes you can skip, which duty you can&apos;t,
            and how far you can slide before the 75% line bites — even with zero network.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["A1–F4 roster engine", "Sentup countdown", "AETCOM + Pandemic modules", "40-step undo"].map((c) => (
              <span key={c} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10.5px] font-bold text-white/60">
                {c}
              </span>
            ))}
          </div>
          <BentoGrid />
          <p className="mt-5 text-[11px] text-white/35 lg:mt-6">
            Built on the published Phase-III timetable &amp; posting rosters. Always confirm critical dates with the college.
          </p>
        </section>

        {/* auth panel */}
        <section className="am-card-in relative self-start [animation-delay:180ms]">
          {/* desktop glow behind the card */}
          <div aria-hidden className="am-glow absolute -inset-5 hidden rounded-[40px] bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-emerald-500/15 blur-2xl lg:block" />
          <div className="relative rounded-[28px] bg-gradient-to-b from-white/20 via-white/10 to-white/5 p-[1px] shadow-2xl shadow-black/60">
            <div className="relative overflow-hidden rounded-[27px] border border-white/10 bg-[#0b0716]/80 px-5 py-7 backdrop-blur-2xl sm:px-7 lg:px-8 lg:py-8">
              {/* top edge highlight */}
              <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent" />

              <div key={`${step}-${deviceOnly}`} className="am-card-in">
                {step === "email" && (
                  <>
                    <div className="text-center">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-600/40">
                        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /></svg>
                      </span>
                      <h2 className="mt-4 text-[21px] font-extrabold tracking-tight">Welcome to AttendMate Pro</h2>
                      <p className="mt-1.5 text-[13px] text-white/55">Sign in to sync across devices — or stay device-only.</p>
                    </div>
                    <label className={`${labelCls} mt-6`} htmlFor="lm-email">Email</label>
                    <input
                      id="lm-email" type="email" value={email} autoComplete="email" autoFocus
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void canEnter()}
                      placeholder="you@gmail.com"
                      className={inputCls}
                    />
                    {err && <p key={err} className="am-shake mt-2.5 text-xs font-semibold text-rose-400">{err}</p>}
                    <button
                      onClick={() => void canEnter()}
                      className="am-sheen relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3.5 text-[14px] font-extrabold shadow-lg shadow-violet-600/40 transition hover:brightness-110 active:scale-[.98]"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                    </button>
                    <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10.5px] font-semibold text-white/40">
                      <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> bcrypt-hashed</span>
                      <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> httpOnly sessions</span>
                      <span className="inline-flex items-center gap-1"><WifiOff className="h-3 w-3" /> offline-first</span>
                    </p>
                  </>
                )}

                {step === "login" && (
                  <>
                    <div className="flex flex-col items-center text-center">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-lg font-extrabold">
                        {email.trim().charAt(0).toUpperCase()}
                      </span>
                      <h2 className="mt-4 text-[19px] font-extrabold tracking-tight">{email}</h2>
                      <p className="mt-1.5 text-[13px] text-white/55">Welcome back — enter your password.</p>
                    </div>
                    <label className={`${labelCls} mt-6`} htmlFor="lm-pass">Password</label>
                    <div className="relative">
                      <input
                        id="lm-pass" type={showPass ? "text" : "password"} value={password} autoComplete="current-password" autoFocus
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void canEnter()}
                        placeholder="••••••••"
                        className={`${inputCls} pr-12`}
                      />
                      <button
                        type="button" onClick={() => setShowPass((v) => !v)}
                        aria-label={showPass ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/45 transition hover:text-white"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {err && <p key={err} className="am-shake mt-2.5 text-xs font-semibold text-rose-400">{err}</p>}
                    <button
                      onClick={() => void canEnter()}
                      className="am-sheen relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3.5 text-[14px] font-extrabold shadow-lg shadow-violet-600/40 transition hover:brightness-110 active:scale-[.98]"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                    </button>
                    <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-4 text-[11px] text-white/45">
                      <button onClick={() => { setStep("email"); setPassword(""); setErr(""); }} className="font-semibold transition hover:text-white/85">← Not you?</button>
                      <span>Sync restores your full dashboard</span>
                    </div>
                  </>
                )}

                {step === "register" && (
                  <>
                    <div className="flex flex-col items-center text-center">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-lg font-extrabold">
                        {email.trim().charAt(0).toUpperCase()}
                      </span>
                      <h2 className="mt-4 text-[19px] font-extrabold tracking-tight">{email}</h2>
                      <p className="mt-1.5 text-[13px] text-white/55">
                        {deviceOnly ? "Offline mode — profile stays on this device." : "Create your account — data syncs & backs up."}
                      </p>
                    </div>
                    <label className={`${labelCls} mt-5`} htmlFor="lm-name">Full name</label>
                    <input
                      id="lm-name" value={name} autoFocus
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Arjun Kumar"
                      className={inputCls}
                    />
                    <label className={`${labelCls} mt-4`} htmlFor="lm-roll">Roll number · 1–100</label>
                    <input
                      id="lm-roll" type="number" min={1} max={100} value={roll}
                      onChange={(e) => setRoll(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void canEnter()}
                      placeholder="e.g. 23"
                      className={inputCls}
                    />
                    {gi && <p className="mt-2 text-[11px] font-bold text-violet-300">→ Group {gi.group} · Sub-group {gi.subGroup}</p>}
                    {!deviceOnly && (
                      <>
                        <label className={`${labelCls} mt-4`} htmlFor="lm-newpass">Password · min 8 characters</label>
                        <div className="relative">
                          <input
                            id="lm-newpass" type={showPass ? "text" : "password"} value={password} autoComplete="new-password"
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && void canEnter()}
                            placeholder="••••••••"
                            className={`${inputCls} pr-12`}
                          />
                          <button
                            type="button" onClick={() => setShowPass((v) => !v)}
                            aria-label={showPass ? "Hide password" : "Show password"}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/45 transition hover:text-white"
                          >
                            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                          <CloudUpload className="h-3.5 w-3.5" />
                          Everything already logged on this device gets imported to your account.
                        </p>
                      </>
                    )}
                    {err && <p key={err} className="am-shake mt-2.5 text-xs font-semibold text-rose-400">{err}</p>}
                    <button
                      onClick={() => void canEnter()}
                      className="am-sheen relative mt-5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3.5 text-[14px] font-extrabold shadow-lg shadow-violet-600/40 transition hover:brightness-110 active:scale-[.98]"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{deviceOnly ? "Continue on this device" : "Create account"} <ArrowRight className="h-4 w-4" /></>}
                    </button>
                    <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-4 text-[11px] text-white/45">
                      <button onClick={() => { setStep("email"); setErr(""); setPassword(""); }} className="font-semibold transition hover:text-white/85">← Change email</button>
                      <button
                        onClick={() => { setDeviceOnly((v) => !v); setErr(""); }}
                        className="font-semibold text-white/60 transition hover:text-white"
                      >
                        {deviceOnly ? "Create an account instead" : "Use this device only"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* footer */}
      <footer className="relative z-10 border-t border-white/[0.07] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <nav className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-[12px] font-semibold text-white/55">
            {["features", "how-it-works", "roster", "faq", "about"].map((r, i) => (
              <span key={r} className="flex items-center">
                {i > 0 && <span className="mx-1.5 text-white/25">·</span>}
                <button onClick={() => nav(r)} className="transition hover:text-white">{r === "how-it-works" ? "guide" : r}</button>
              </span>
            ))}
          </nav>
          <p className="text-center text-[11px] text-white/35 sm:text-right">© 2026 AttendMate Pro · your attendance never trains anyone&apos;s model</p>
        </div>
      </footer>
    </div>
  );
}
