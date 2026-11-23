"use client";
// First-run consent: explicit permission before anything is written to the
// device. Declining = memory-only (zero writes — not even this choice, which
// is why the question reappears next visit). Changeable later in
// Settings → "Storage on this device".
import { HardDrive, MemoryStick, ShieldCheck } from "lucide-react";
import { BrandMark } from "./bits";
import { useAttendMate } from "@/lib/attendmate/storage";

export default function StorageConsent() {
  const { grantStorage, denyStorage } = useAttendMate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Device storage permission">
      <div className="clay-card w-full max-w-md p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <BrandMark size={40} />
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Nothing is uploaded
          </span>
        </div>
        <h1 className="mt-4 text-[17px] font-extrabold leading-snug">Store your data on this device?</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          AttendMate Pro keeps <b className="text-foreground">everything on your device only</b> — attendance, subjects,
          module progress, settings. Your account on our server holds just your
          <b className="text-foreground"> sign-in credentials</b> (email, password, 2FA). There is no data sync and no server copy.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Allow saving so your data survives closing the browser? You can change this anytime in
          Settings → <b className="text-foreground">Storage on this device</b>.
        </p>

        <div className="mt-5 space-y-2.5">
          <button onClick={() => void grantStorage()} className="clay-btn clay-primary clay-lg w-full justify-center">
            <HardDrive className="h-4 w-4" /> Allow — save on this device
          </button>
          <button onClick={denyStorage} className="clay-btn clay-soft clay-md w-full justify-center">
            <MemoryStick className="h-4 w-4" /> Don&apos;t allow — memory only
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          If you don&apos;t allow, nothing is written — not even this choice — so data resets when the page closes and
          we&apos;ll ask again next time.
        </p>
      </div>
    </div>
  );
}
