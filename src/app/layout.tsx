import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AttendMate Pro — NSMCH Phase-III (Part-2) Attendance Tracker",
  description:
    "Offline-first attendance intelligence for NSMCH Bihta Phase-III (Part-2): roster resolver, safe-bunk planner, heatmap calendar, analytics and a projection to Sentup. Built with the Originkit Dither Reveal.",
  keywords: ["AttendMate", "attendance", "NSMCH", "medical school", "Phase-III", "tracker"],
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
};

const themePrepaint = `
try {
  var t = localStorage.getItem('attendmate_site_theme');
  if (t === 'dark') document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <script dangerouslySetInnerHTML={{ __html: themePrepaint }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
