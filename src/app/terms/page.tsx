import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — AttendMate Pro",
  description: "The short, plain terms for using AttendMate Pro.",
};

const REPO = "https://github.com/arpitnayan123-bot/med-attendence";

function TermsShell({ children }: { children: React.ReactNode }) {
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

export default function TermsPage() {
  return (
    <TermsShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Terms</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">Short and plain. Last revised: 23 November 2026.</p>

      <H>What this is</H>
      <P>AttendMate Pro is an unofficial, offline-first attendance tracker built for students of NSMCH Bihta, Phase-III (Part-2). It is not an official college app and is not affiliated with, endorsed by, or maintained by the college.</P>

      <H>Your data is your responsibility</H>
      <P>Attendance records live only in your browser. Clearing browser data erases them. Export a JSON backup regularly (Settings → Export backup) — lost logs cannot be recovered by anyone else.</P>

      <H>Accuracy of schedules</H>
      <P>The timetables, posting rosters and exam windows are transcriptions of the official Phase-III (Part-2) schedule and can shift. Verify dates with your department or coordinator; the app&apos;s advice is a planning aid, not an attendance record your college will accept.</P>

      <H>Accounts</H>
      <P>An account is optional and exists only to password-protect your profile on this device. One roll number maps to one account; the server rejects duplicates. You may sign out, export, or erase your data at any time — see Privacy for the erase procedure.</P>

      <H>No warranty</H>
      <P>The app is provided as-is, without warranty of any kind. Percentages, projections and skip advice are arithmetic over what you log — they are not attendance rulings and carry no official weight.</P>

      <H>Changes</H>
      <P>These terms may be revised when the app changes; the revision date at the top always reflects the current version. Persistent issues: <a className="font-semibold text-orange-600 hover:underline dark:text-orange-400" href={REPO}>{REPO}</a></P>
    </TermsShell>
  );
}
