"use client";
// Landing page = sign-in. Originkit "Dither Reveal" animation fills the
// screen on a dark background; a minimal glass sign-in card sits on top.
// Accounts are real (server-side, bcrypt + JWT cookie sessions); a
// "device only" path keeps the app fully usable offline-first.
import { useEffect, useState } from "react";
import { ArrowRight, CloudUpload, Loader2, ShieldCheck } from "lucide-react";
import DitherReveal from "@/components/originkit/ui/dither-reveal";
import { BrandWord } from "./bits";
import { useAttendMate } from "@/lib/attendmate/storage";
import { apiExists, apiResetRequest } from "@/lib/attendmate/sync";
import { getGroupInfo } from "@/lib/attendmate/engine";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn({ onDone, nav }: { onDone: () => void; nav: (to: string) => void }) {
  const { state, claimDeviceProfile, signIn, verifyTotp, signUp } = useAttendMate();
  const [step, setStep] = useState<"email" | "login" | "register" | "totp" | "forgot">("email");
  const [deviceOnly, setDeviceOnly] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  // Prefill from the device copy only when it is un-owned guest data; a copy
  // tagged with another student's account must never leak name/roll here.
  const [name, setName] = useState(state.syncOwnerId ? "" : (state.profile.name || ""));
  const [roll, setRoll] = useState<string>(!state.syncOwnerId && state.profile.rollNo > 1 ? String(state.profile.rollNo) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const finish = () => {
    setBusy(true);
    setTimeout(onDone, 300);
  };

  // Live roll availability — every student gets exactly one roll (the server
  // rejects duplicates at register); checking as they type means a taken roll
  // never surprises anyone at submit time. Device-only profiles skip this:
  // there is no server truth to check against.
  const [rollCheck, setRollCheck] = useState<{ state: "checking" | "free" | "taken" } | null>(null);
  useEffect(() => {
    const r = parseInt(roll, 10);
    if (step !== "register" || deviceOnly || !(r >= 1 && r <= 100)) { setRollCheck(null); return; }
    setRollCheck({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/roll?roll=${r}`);
        const body = await res.json().catch(() => null);
        setRollCheck(res.ok && body ? { state: body.taken ? "taken" : "free" } : null);
      } catch { setRollCheck(null); } // offline — submit-time check still protects uniqueness
    }, 400);
    return () => clearTimeout(t);
  }, [roll, step, deviceOnly]);

  const submitEmail = async () => {
    if (!EMAIL_RE.test(email)) { setErr("Enter a valid email address"); return; }
    setErr("");
    setBusy(true);
    try {
      const exists = await apiExists(email.trim().toLowerCase());
      setDeviceOnly(false);
      setStep(exists ? "login" : "register");
    } catch {
      // server unreachable — offer the offline device-only path
      setErr("Can't reach the sign-in server right now — you can continue on this device only.");
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
    else if (r.twoFactorRequired) setStep("totp"); // password verified — now the code
    else setErr(r.error || "Invalid email or password");
  };

  const submitTotp = async () => {
    if (!totpCode.trim()) { setErr("Enter the 6-digit code or a backup code"); return; }
    setErr("");
    setBusy(true);
    const r = await verifyTotp(totpCode.trim());
    setBusy(false);
    if (r.ok) finish();
    else setErr(r.error || "Invalid or expired code");
  };

  const submitForgot = async () => {
    if (!EMAIL_RE.test(email)) { setErr("Enter a valid email address"); return; }
    setErr("");
    setBusy(true);
    try {
      await apiResetRequest(email.trim().toLowerCase());
      setForgotSent(true);
    } catch {
      setErr("Can't reach the server right now — try again later.");
    } finally {
      setBusy(false);
    }
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
      // A device-only profile claims the guest store as this device's primary
      // identity. If an account copy is active it is parked under its own
      // owner key first (sign back in to get it back) — never wiped inline.
      claimDeviceProfile(n, email.trim(), r);
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
  const canEnter =
    step === "email" ? submitEmail
    : step === "login" ? submitLogin
    : step === "totp" ? submitTotp
    : step === "forgot" ? submitForgot
    : submitRegister;

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
          <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Encrypted sync · stored on this device too
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-[400px] rounded-3xl border border-white/15 bg-black/45 p-7 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:p-8">
            {step === "email" && (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /></svg>
                  </span>
                  <h1 className="text-[22px] font-bold tracking-tight">Sign in</h1>
                  <p className="mt-1.5 text-[13px] text-white/60">to sync AttendMate Pro across devices</p>
                </div>
                <label className="mb-1 block text-xs font-semibold text-white/70" htmlFor="lm-email">Email</label>
                <input
                  id="lm-email" type="email" value={email} autoComplete="email" autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void canEnter()}
                  placeholder="you@gmail.com"
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-violet-400/70 focus:bg-white/15"
                />
                {err && <p className="mt-2 text-xs font-medium text-rose-400">{err}</p>}
                <button
                  onClick={() => void canEnter()}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-[14px] font-bold shadow-lg shadow-violet-600/40 transition hover:brightness-110 active:scale-[.99]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Next <ArrowRight className="h-4 w-4" /></>}
                </button>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/45">
                  <span>English (India)</span>
                  <span>Help · Privacy · Terms</span>
                </div>
              </>
            )}

            {step === "login" && (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-lg font-bold">
                    {email.trim().charAt(0).toUpperCase()}
                  </span>
                  <h1 className="text-[20px] font-bold tracking-tight">{email}</h1>
                  <p className="mt-1.5 text-[13px] text-white/60">Welcome back — enter your password</p>
                </div>
                <label className="mb-1 block text-xs font-semibold text-white/70" htmlFor="lm-pass">Password</label>
                <input
                  id="lm-pass" type="password" value={password} autoComplete="current-password" autoFocus
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void canEnter()}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-violet-400/70 focus:bg-white/15"
                />
                {err && <p className="mt-2 text-xs font-medium text-rose-400">{err}</p>}
                <button
                  onClick={() => void canEnter()}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-[14px] font-bold shadow-lg shadow-violet-600/40 transition hover:brightness-110 active:scale-[.99]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                </button>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/45">
                  <button onClick={() => { setStep("email"); setPassword(""); setErr(""); }} className="hover:text-white/80">← Not you?</button>
                  <button onClick={() => { setStep("forgot"); setForgotSent(false); setErr(""); }} className="font-semibold text-white/60 transition hover:text-white">Forgot password?</button>
                </div>
              </>
            )}

            {step === "totp" && (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10">
                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                  </span>
                  <h1 className="text-[20px] font-bold tracking-tight">Two-step verification</h1>
                  <p className="mt-1.5 text-[13px] text-white/60">Enter the 6-digit code from your authenticator app — a backup code works here too.</p>
                </div>
                <input
                  value={totpCode} autoFocus
                  onChange={(e) => setTotpCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void canEnter()}
                  placeholder="123 456 — or K7MP-W3RT"
                  autoComplete="one-time-code"
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center text-[18px] font-bold tracking-[0.2em] text-white placeholder-white/30 outline-none transition focus:border-violet-400/70 focus:bg-white/15"
                />
                {err && <p className="mt-2 text-xs font-medium text-rose-400">{err}</p>}
                <button
                  onClick={() => void canEnter()}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-[14px] font-bold shadow-lg shadow-violet-600/40 transition hover:brightness-110 active:scale-[.99]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Verify <ArrowRight className="h-4 w-4" /></>}
                </button>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/45">
                  <button onClick={() => { setStep("email"); setTotpCode(""); setErr(""); }} className="hover:text-white/80">← Use a different account</button>
                  <span>Codes rotate every 30 s</span>
                </div>
              </>
            )}

            {step === "forgot" && (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-lg font-bold">
                    {email.trim().charAt(0).toUpperCase()}
                  </span>
                  <h1 className="text-[20px] font-bold tracking-tight">Reset password</h1>
                  <p className="mt-1.5 text-[13px] text-white/60">We'll email a single-use reset link (valid 15 minutes).</p>
                </div>
                {forgotSent ? (
                  <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-[12px] font-semibold text-emerald-300">
                    If that email has an account and mail is configured, the reset link is on its way. Check your inbox.
                  </p>
                ) : (
                  <input
                    type="email" value={email} autoFocus
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void canEnter()}
                    placeholder="you@gmail.com"
                    className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-violet-400/70 focus:bg-white/15"
                  />
                )}
                {err && <p className="mt-2 text-xs font-medium text-rose-400">{err}</p>}
                {!forgotSent && (
                  <button
                    onClick={() => void canEnter()}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-[14px] font-bold shadow-lg shadow-violet-600/40 transition hover:brightness-110 active:scale-[.99]"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send reset link <ArrowRight className="h-4 w-4" /></>}
                  </button>
                )}
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/45">
                  <button onClick={() => { setStep(forgotSent ? "login" : "email"); setErr(""); }} className="hover:text-white/80">← Back</button>
                  <span>Reset signs out every device</span>
                </div>
              </>
            )}

            {step === "register" && (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-lg font-bold">
                    {email.trim().charAt(0).toUpperCase()}
                  </span>
                  <h1 className="text-[20px] font-bold tracking-tight">{email}</h1>
                  <p className="mt-1.5 text-[13px] text-white/60">
                    {deviceOnly ? "Offline mode — profile stays on this device" : "Create your account — nothing gets uploaded"}
                  </p>
                </div>
                <label className="mb-1 block text-xs font-semibold text-white/70" htmlFor="lm-name">Full name</label>
                <input
                  id="lm-name" value={name} autoFocus
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Arjun Kumar"
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-violet-400/70 focus:bg-white/15"
                />
                <label className="mb-1 mt-4 block text-xs font-semibold text-white/70" htmlFor="lm-roll">Roll number <span className="font-normal text-white/45">· 1–100</span></label>
                <input
                  id="lm-roll" type="number" min={1} max={100} value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void canEnter()}
                  placeholder="e.g. 23"
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-violet-400/70 focus:bg-white/15"
                />
                {gi && (
                  <p className="mt-2 text-[11px] font-semibold text-violet-300">→ Group {gi.group} · Sub-group {gi.subGroup}</p>
                )}
                {!deviceOnly && rollCheck && rollCheck.state !== "checking" && (
                  <p className={`mt-1.5 text-[11px] font-semibold ${rollCheck.state === "taken" ? "text-rose-400" : "text-emerald-300"}`}>
                    {rollCheck.state === "free"
                      ? `✓ Roll ${roll} is free — it will be yours alone, unique across the batch`
                      : `✗ Roll ${roll} is already taken — each roll number belongs to exactly one student`}
                  </p>
                )}
                {!deviceOnly && (
                  <>
                    <label className="mb-1 mt-4 block text-xs font-semibold text-white/70" htmlFor="lm-newpass">Password <span className="font-normal text-white/45">· min 8 characters</span></label>
                    <input
                      id="lm-newpass" type="password" value={password} autoComplete="new-password"
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void canEnter()}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-violet-400/70 focus:bg-white/15"
                    />
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300">
                      <CloudUpload className="h-3.5 w-3.5" />
                      Everything already logged on this device stays on this device — it is kept under your new account locally, never uploaded.
                    </p>
                  </>
                )}
                {err && <p className="mt-2 text-xs font-medium text-rose-400">{err}</p>}
                <button
                  onClick={() => void canEnter()}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-[14px] font-bold shadow-lg shadow-violet-600/40 transition hover:brightness-110 active:scale-[.99]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{deviceOnly ? "Continue on this device" : "Create account"} <ArrowRight className="h-4 w-4" /></>}
                </button>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/45">
                  <button onClick={() => { setStep("email"); setErr(""); setPassword(""); }} className="hover:text-white/80">← Change email</button>
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
          <p className="text-[11px] text-white/35">Unofficial · offline-first · your attendance never leaves your devices</p>
        </footer>
      </div>
    </div>
  );
}
