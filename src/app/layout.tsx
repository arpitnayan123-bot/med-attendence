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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "AttendMate Pro — NSMCH Phase-III (Part-2) Attendance Tracker",
  description:
    "Offline-first attendance tracker for NSMCH Bihta Phase-III (Part-2): roster-resolved clinical postings, safe-skip maths, exam-aware analytics and a session-end projection. Your attendance stays on your device.",
  keywords: ["AttendMate", "attendance", "NSMCH", "medical school", "Phase-III", "tracker"],
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    title: "AttendMate Pro — NSMCH Phase-III (Part-2) Attendance Tracker",
    description:
      "Offline-first attendance tracking with honest arithmetic: safe-skip maths, roster-resolved postings, exam-aware projections. Your attendance stays on your device.",
    url: "/",
    siteName: "AttendMate Pro",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "AttendMate Pro — attendance tracker for NSMCH Phase-III (Part-2)" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AttendMate Pro — NSMCH Phase-III (Part-2) Attendance Tracker",
    description: "Offline-first attendance tracking with honest arithmetic. Your attendance stays on your device.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
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
