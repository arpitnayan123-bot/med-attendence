"use client";
// Settings → Security: TOTP two-factor auth (QR enrolment + one-time backup
// codes), the device/session list with remote sign-out, the login audit trail,
// password change (step-up: other devices are signed out on success), and the
// device-storage consent card (this app stores nothing on the server).
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check, Copy, Download, HardDrive, History, KeyRound, Loader2, MemoryStick,
  MonitorSmartphone, ShieldCheck, ShieldOff, Smartphone, Trash2, SaveOff,
} from "lucide-react";
import { useAttendMate } from "@/lib/attendmate/storage";
import {
  apiSecurity, apiSessions, apiSetup2fa, apiEnable2fa, apiDisable2fa, apiRegenBackupCodes,
  apiChangePassword, apiRevokeSession, apiRevokeAllSessions,
  SecurityStatus, DeviceSession,
} from "@/lib/attendmate/sync";
import { storageUsage } from "@/lib/attendmate/device-storage";

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function BackupCodeGrid({ codes }: { codes: string[] }) {
  const fileRef = useRef<HTMLAnchorElement>(null);
  const copyAll = () => void navigator.clipboard?.writeText(codes.join("\n"));
  const download = () => {
    const blob = new Blob([`AttendMate Pro backup codes\n\n${codes.join("\n")}\n`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "attendmate-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="text-[11px] font-bold text-amber-600 dark:text-amber-300">
        Save these now — each works once, and they&apos;re the only way in if you lose your phone.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {codes.map((c) => (
          <code key={c} className="rounded-lg border bg-background px-2 py-1.5 text-center text-[11px] font-bold tracking-wide">{c}</code>
        ))}
      </div>
      <div className="mt-2.5 flex gap-2">
        <button onClick={copyAll} className="clay-btn clay-soft clay-sm"><Copy className="h-3.5 w-3.5" /> Copy all</button>
        <button onClick={download} className="clay-btn clay-soft clay-sm"><Download className="h-3.5 w-3.5" /> Save file</button>
      </div>
    </div>
  );
}

export default function SecuritySection() {
  const { authed, signOut } = useAttendMate();
  const [sec, setSec] = useState<SecurityStatus | null>(null);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  // 2FA enrolment state
  const [qr, setQr] = useState<{ uri: string; qrDataUrl: string } | null>(null);
  const [enrollCode, setEnrollCode] = useState("");

  // disable / regenerate state
  const [disPw, setDisPw] = useState("");
  const [disCode, setDisCode] = useState("");

  // change-password state
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwCode, setPwCode] = useState("");

  const reload = useCallback(async () => {
    try {
      setSec(await apiSecurity());
      setDevices(await apiSessions());
    } catch { /* signed out / offline */ }
  }, []);

  useEffect(() => {
    if (authed) void reload();
    else { setSec(null); setDevices([]); }
  }, [authed, reload]);

  const run = useCallback(async (label: string, fn: () => Promise<void>, okMsg?: string) => {
    setErr(""); setMsg(""); setBusy(label);
    try {
      await fn();
      if (okMsg) setMsg(okMsg);
      await reload();
    } catch (e) {
      setErr((e as Error).message || "Something went wrong");
    } finally {
      setBusy("");
    }
  }, [reload]);

  const leaveAllDevices = async () => {
    setBusy("leave"); setErr("");
    try {
      await apiRevokeAllSessions();
      await signOut();
      window.location.hash = "/";
      window.location.reload(); // provider reboots clean — session is gone server-side anyway
    } catch (e) {
      setErr((e as Error).message || "Couldn't sign out everywhere");
      setBusy("");
    }
  };

  const revokeOne = async (id: string) => {
    setErr(""); setMsg("");
    try {
      const r = await apiRevokeSession(id);
      if (r.signedOut) {
        await signOut();
        window.location.hash = "/";
        window.location.reload();
        return;
      }
      setDevices((ds) => ds.filter((d) => d.id !== id));
      setMsg("Device signed out.");
    } catch (e) {
      setErr((e as Error).message || "Couldn't sign out that device");
    }
  };

  if (!authed || !sec) return null;

  const btn = "clay-btn clay-soft clay-md";
  const disabled = busy !== "";

  return (
    <>
      {msg && <p className="clay-card col-span-full p-3 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 lg:col-span-2">{msg}</p>}
      {err && <p className="clay-card col-span-full p-3 text-[12px] font-semibold text-rose-600 dark:text-rose-300 lg:col-span-2">{err}</p>}

      {/* ---- Two-factor authentication ---- */}
      <section className="clay-card p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
          <h2 className="text-[15px] font-extrabold">Two-factor authentication</h2>
          <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold ${sec.totpEnabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
            {sec.totpEnabled ? `On · ${sec.backupCodesLeft} backup code${sec.backupCodesLeft === 1 ? "" : "s"} left` : "Off"}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          A 6-digit code from Google Authenticator / Aegis after your password — a stolen password alone can no longer open your account.
        </p>

        {sec.totpEnabled ? (
          <div className="mt-4 space-y-2.5">
            <div className="flex flex-wrap gap-2">
              <button disabled={disabled} onClick={() => setNewCodes(newCodes ? null : [])} className={btn}>
                <KeyRound className="h-4 w-4" /> {newCodes ? "Close" : "Regenerate backup codes"}
              </button>
            </div>
            {newCodes !== null && (
              <div className="rounded-xl border border-dashed p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">Confirm with your password to replace the old codes:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input type="password" value={disPw} onChange={(e) => setDisPw(e.target.value)} placeholder="Current password" autoComplete="current-password"
                    className="clay-input w-full max-w-[240px] px-3.5 py-2.5 text-[13px]" />
                  <button disabled={disabled || !disPw} onClick={() => void run("regen", async () => {
                    const r = await apiRegenBackupCodes(disPw);
                    setNewCodes(r.backupCodes);
                    setDisPw("");
                  }, "New backup codes generated — save them now.")} className="clay-btn clay-primary clay-md">
                    {busy === "regen" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
                  </button>
                </div>
                {newCodes.length > 0 && <BackupCodeGrid codes={newCodes} />}
              </div>
            )}
            <details className="rounded-xl border border-dashed p-3">
              <summary className="cursor-pointer text-[12px] font-bold">Turn 2FA off</summary>
              <p className="mt-2 text-[11px] text-muted-foreground">Requires your password and a live code (backup codes work).</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input type="password" value={disPw} onChange={(e) => setDisPw(e.target.value)} placeholder="Current password" autoComplete="current-password"
                  className="clay-input w-full max-w-[220px] px-3.5 py-2.5 text-[13px]" />
                <input value={disCode} onChange={(e) => setDisCode(e.target.value)} placeholder="Code" inputMode="text"
                  className="clay-input w-28 px-3.5 py-2.5 text-[13px]" />
                <button disabled={disabled || !disPw || !disCode} onClick={() => void run("dis", async () => {
                  await apiDisable2fa(disPw, disCode);
                  setDisPw(""); setDisCode("");
                }, "Two-factor authentication turned off.")} className="clay-btn clay-danger clay-md">
                  {busy === "dis" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />} Disable
                </button>
              </div>
            </details>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {!qr ? (
              <button disabled={disabled} onClick={() => void run("qr", async () => setQr(await apiSetup2fa()))} className="clay-btn clay-primary clay-md">
                <ShieldCheck className="h-4 w-4" /> Enable 2FA
              </button>
            ) : (
              <div className="rounded-xl border border-dashed p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">1. Scan with your authenticator app (or paste the key):</p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <img src={qr.qrDataUrl} alt="2FA QR code" width={130} height={130} className="rounded-lg border bg-white p-1" />
                  <code className="max-w-[200px] break-all rounded-lg border bg-background px-2 py-1 text-[10px]">
                    {qr.uri.match(/secret=([^&]+)/)?.[1] || qr.uri}
                  </code>
                </div>
                <p className="mt-3 text-[11px] font-semibold text-muted-foreground">2. Enter the current 6-digit code to finish:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input value={enrollCode} onChange={(e) => setEnrollCode(e.target.value)} placeholder="123456" inputMode="numeric" autoFocus
                    className="clay-input w-32 px-3.5 py-2.5 text-center text-[15px] font-bold tracking-widest" />
                  <button disabled={disabled || enrollCode.length < 6} onClick={() => void run("en", async () => {
                    const r = await apiEnable2fa(enrollCode.trim());
                    setQr(null); setEnrollCode("");
                    setNewCodes(r.backupCodes);
                  }, "")} className="clay-btn clay-primary clay-md">
                    {busy === "en" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Verify &amp; enable</>}
                  </button>
                  <button onClick={() => { setQr(null); setEnrollCode(""); }} className={btn}>Cancel</button>
                </div>
                {newCodes && newCodes.length > 0 && (
                  <>
                    <p className="mt-3 text-[12px] font-extrabold text-emerald-600 dark:text-emerald-400">2FA is on.</p>
                    <BackupCodeGrid codes={newCodes} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---- Change password ---- */}
      <section className="clay-card p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4.5 w-4.5 text-violet-500" />
          <h2 className="text-[15px] font-extrabold">Change password</h2>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Every other device is signed out when you change it.</p>
        <div className="mt-4 space-y-2.5">
          <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="Current password" autoComplete="current-password"
            className="clay-input w-full max-w-[300px] px-3.5 py-2.5 text-[13px]" />
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (min 8 characters)" autoComplete="new-password"
            className="clay-input w-full max-w-[300px] px-3.5 py-2.5 text-[13px]" />
          <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} placeholder="Repeat new password" autoComplete="new-password"
            className="clay-input w-full max-w-[300px] px-3.5 py-2.5 text-[13px]" />
          {sec.totpEnabled && (
            <input value={pwCode} onChange={(e) => setPwCode(e.target.value)} placeholder="Authenticator code" inputMode="numeric"
              className="clay-input w-40 px-3.5 py-2.5 text-[13px]" />
          )}
          <button
            disabled={disabled || !curPw || !newPw || newPw !== newPw2 || (sec.totpEnabled && pwCode.length < 6)}
            onClick={() => void run("pw", async () => {
              await apiChangePassword(curPw, newPw, sec.totpEnabled ? pwCode : undefined);
              setCurPw(""); setNewPw(""); setNewPw2(""); setPwCode("");
            }, "Password changed — other devices were signed out.")}
            className="clay-btn clay-primary clay-md"
          >
            {busy === "pw" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
          </button>
          {newPw && newPw2 && newPw !== newPw2 && <p className="text-[11px] font-semibold text-rose-500">The two passwords don&apos;t match.</p>}
        </div>
      </section>

      {/* ---- Devices ---- */}
      <section className="clay-card p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <MonitorSmartphone className="h-4.5 w-4.5 text-sky-500" />
          <h2 className="text-[15px] font-extrabold">Signed-in devices</h2>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{devices.length} active</span>
          {devices.length > 1 && (
            <button onClick={() => void leaveAllDevices()} className="clay-btn clay-danger clay-sm ml-auto">
              {busy === "leave" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sign out everywhere"}
            </button>
          )}
        </div>
        <div className="mt-3 divide-y">
          {devices.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-[13px] font-bold">{d.label}</span>
              {d.current && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">This device</span>}
              <span className="text-[11px] text-muted-foreground">{d.ip} · active {timeAgo(d.lastSeenAt)}</span>
              {!d.current && (
                <button onClick={() => void revokeOne(d.id)} className="clay-btn clay-soft clay-sm ml-auto">Sign out</button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---- Login history ---- */}
      <section className="clay-card p-5 lg:col-span-2">
        <div className="flex items-center gap-2">
          <History className="h-4.5 w-4.5 text-amber-500" />
          <h2 className="text-[15px] font-extrabold">Login history</h2>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {sec.mailConfigured
            ? "You also get an email whenever a brand-new device signs in."
            : "Email alerts are dormant until a mail key (RESEND_API_KEY) is configured — the trail below still records everything."}
        </p>
        {sec.loginEvents.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <div className="mt-3 divide-y">
            {sec.loginEvents.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  e.label === "Signed in" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : e.label === "Locked out" || e.label === "Wrong password" || e.label === "Wrong 2FA code" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                }`}>{e.label}</span>
                <span className="text-[12px] font-semibold">{e.device}</span>
                {e.newDevice && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">new device</span>}
                <span className="text-[11px] text-muted-foreground">{e.ip} · {timeAgo(e.at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* ================= STORAGE ON THIS DEVICE ================= */
// The consent surface for the device-only data model: what is stored, how
// much, and full control (allow / turn off / make persistent / erase all).
export function StorageCard() {
  const { storageState, persistent, grantStorage, denyStorage, requestPersistent, forgetDevice } = useAttendMate();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void storageUsage().then(setUsage);
  }, [storageState]);

  const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

  const chip =
    storageState === "granted"
      ? { text: persistent ? "Saving · persistent" : "Saving", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", Icon: HardDrive }
      : storageState === "denied"
        ? { text: "Not saving — memory only", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", Icon: SaveOff }
        : { text: "Permission not set", cls: "bg-muted text-muted-foreground", Icon: MemoryStick };

  return (
    <section className="clay-card p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <chip.Icon className="h-4.5 w-4.5 text-sky-500" />
        <h2 className="text-[15px] font-extrabold">Storage on this device</h2>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.cls}`}>{chip.text}</span>
      </div>
      <p className="mt-1.5 max-w-[75ch] text-xs text-muted-foreground">
        All of your data — attendance, subjects, module progress, targets, theme — lives <b className="text-foreground">only in this
        browser</b>, in your own store, isolated per account on shared devices. The server keeps just your sign-in credentials
        (email, password, 2FA). To move devices, use <b className="text-foreground">Export backup</b> below and import the file there.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {usage && usage.quota > 0 && (
          <span className="rounded-lg border bg-muted/50 px-2.5 py-1 font-semibold">
            Using {mb(usage.usage)} of {mb(usage.quota)} available
          </span>
        )}
        {storageState === "granted" && !persistent && (
          <button onClick={() => void requestPersistent()} className="clay-btn clay-soft clay-sm">
            <HardDrive className="h-3.5 w-3.5" /> Make storage persistent
          </button>
        )}
        {storageState === "denied" && (
          <span className="font-semibold text-amber-600 dark:text-amber-400">Changes are kept only until the page closes.</span>
        )}
      </div>
      {msg && <p className="mt-2 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">{msg}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {(storageState === "unknown" || storageState === "denied") && (
          <button onClick={() => void grantStorage().then(() => setMsg("Saving allowed — your data now survives closing the browser."))} className="clay-btn clay-primary clay-md">
            <HardDrive className="h-4 w-4" /> Allow saving on this device
          </button>
        )}
        {storageState === "granted" && (
          <button onClick={() => { denyStorage(); setMsg("Saving turned off — nothing more will be written. Stored files stay until you erase them."); }} className="clay-btn clay-soft clay-md">
            <SaveOff className="h-4 w-4" /> Turn off saving
          </button>
        )}
        {confirmForget ? (
          <span className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/50 bg-rose-500/5 px-3 py-2 text-[12px] font-bold text-rose-600 dark:text-rose-300">
            Erase every AttendMate data file on this device (all accounts + guest)?
            <button
              onClick={() => { forgetDevice(); setConfirmForget(false); setMsg("All stored data erased from this device."); }}
              className="clay-btn clay-danger clay-sm rounded-[0.7rem]"
            >Yes, erase</button>
            <button onClick={() => setConfirmForget(false)} className="clay-btn clay-soft clay-sm rounded-[0.7rem]">Cancel</button>
          </span>
        ) : (
          <button onClick={() => setConfirmForget(true)} className="clay-btn clay-danger clay-md">
            <Trash2 className="h-4 w-4" /> Erase stored data
          </button>
        )}
      </div>
    </section>
  );
}
