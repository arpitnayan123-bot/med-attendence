import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — AttendMate Pro",
  description: "What the AttendMate Pro server stores, what stays on your device, and how to export or erase it.",
};

const REPO = "https://github.com/arpitnayan123-bot/med-attendence";

function PolicyShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-background px-5 py-12 text-foreground">
      {children}
      <p className="mt-10 text-[13px]">
        <a href="/" className="font-semibold text-orange-600 hover:underline dark:text-orange-400">← Back to AttendMate Pro</a>
      </p>
    </main>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-[16px] font-extrabold">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{children}</p>;
}

function L({ children }: { children: React.ReactNode }) {
  return <li className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{children}</li>;
}

export default function PrivacyPage() {
  return (
    <PolicyShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Privacy</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">Plain language, no dark patterns. Last revised: 23 November 2026.</p>

      <H>The one-sentence version</H>
      <P>Your email goes to our server to identify the account; your attendance never does.</P>

      <H>What the server stores</H>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <L>Email address and a bcrypt password hash — used only to authenticate you.</L>
        <L>Your name and roll number, as entered at registration.</L>
        <L>Your 2FA secret (encrypted at rest) and any backup codes, when you enable two-step verification.</L>
        <L>Session metadata: device label, IP address and timestamps for the sign-in history you can see in Settings → Security.</L>
      </ul>

      <H>What stays on your device, never uploaded</H>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <L>Every attendance mark, for every slot, on every day.</L>
        <L>Prior-record baselines, subject targets and module progress.</L>
        <L>Your theme and view preferences.</L>
      </ul>
      <P>There is no automatic sync. Attendance data is written only to your browser&apos;s local storage, behind an explicit storage consent. Moving devices means exporting the JSON backup from Settings and importing it on the other device — or restoring a device snapshot.</P>

      <H>Export and erase</H>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <L>Export: Settings → Export backup writes a JSON file you own.</L>
        <L>Erase locally: Settings → Erase stored data removes every attendance record from this browser immediately.</L>
        <L>Erase the account record: email the repository below and the server-side account (email, hash, 2FA secret, session metadata) is deleted.</L>
      </ul>

      <H>Two-step verification</H>
      <P>When enabled, sign-in needs a time-based code from your authenticator app (or a backup code). You can review every active session and revoke any device from Settings → Security, or sign out everywhere at once.</P>

      <H>Contact</H>
      <P>Issues and account-removal requests: <a className="font-semibold text-orange-600 hover:underline dark:text-orange-400" href={REPO}>{REPO}</a></P>
    </PolicyShell>
  );
}
