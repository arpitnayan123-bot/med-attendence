"use client";
// AttendMate Pro — single-route app with hash navigation:
//   #/            → landing (sign-in, Originkit Dither Reveal) or dashboard if signed in
//   #/dashboard   → the attendance dashboard
//   #/features | #/how-it-works | #/roster | #/faq | #/about → marketing pages
//   anything else → 404
import { useEffect } from "react";
import { AttendMateProvider, useAttendMate, isSignedIn, getStoredTheme, applyThemeClass } from "@/lib/attendmate/storage";
import { useHashRoute } from "./bits";
import SignIn from "./SignIn";
import Dashboard from "./Dashboard";
import { SiteChrome, FeaturesPage, GuidePage, RosterPage, FaqPage, AboutPage, NotFoundPage } from "./Site";

const MARKETING = ["features", "how-it-works", "roster", "faq", "about"] as const;

function Shell() {
  const { state, authed } = useAttendMate();
  const [route, nav] = useHashRoute();

  useEffect(() => { applyThemeClass(getStoredTheme()); }, []);

  /**
   * Account isolation on shared browsers: a device copy tagged with a server
   * account unlocks the dashboard only while that account's session is live.
   * (Device-only copies — no syncOwnerId — stay usable offline.) Without this,
   * student B would land on student A's dashboard after A signed out.
   */
  const locked = !isSignedIn(state) || (Boolean(state.syncOwnerId) && !authed);

  if (route === "dashboard") return locked ? <SignIn onDone={() => nav("dashboard")} nav={nav} /> : <Dashboard nav={nav} />;

  if ((MARKETING as readonly string[]).includes(route)) {
    const map = {
      features: FeaturesPage,
      "how-it-works": GuidePage,
      roster: RosterPage,
      faq: FaqPage,
      about: AboutPage,
    } as const;
    const Page = map[route as keyof typeof map];
    return <SiteChrome route={route} nav={nav}><Page nav={nav} /></SiteChrome>;
  }

  if (route === "" || route === "/") {
    return locked
      ? <SignIn onDone={() => nav("dashboard")} nav={nav} />
      : <Dashboard nav={nav} />;
  }

  return <SiteChrome route={route} nav={nav}><NotFoundPage nav={nav} /></SiteChrome>;
}

export default function AttendMateApp() {
  return (
    <AttendMateProvider>
      <Shell />
    </AttendMateProvider>
  );
}
