// Unit tests for the activity analytics engine (contribution graph + stats).
// Run: bun test tests/activity.test.ts
import { describe, test, expect } from "bun:test";
import { AppState } from "../src/lib/attendmate/data";
import { activityFor, buildHeatmapWeeks, computeActivityStats } from "../src/lib/attendmate/activity";

// 2026-11-23 is a Monday (5 scheduled slots), 2026-11-22 a Sunday (0).
const MON = "2026-11-23";
const SUN = "2026-11-22";

function mkState(logs: AppState["logs"]): AppState {
  return { logs } as unknown as AppState;
}
const P = { status: "present" as const, subject: "IM", kind: "theory" as const, custom: false };
const A = { ...P, status: "absent" as const };

describe("activityFor — heat tiers", () => {
  test("no marks → tier 0", () => {
    expect(activityFor(mkState({}), MON).tier).toBe(0);
  });
  test("2 of 5 marked → tier 2 (40%)", () => {
    const d = activityFor(mkState({ [MON]: { a: P, b: P } }), MON);
    expect(d.scheduled).toBe(5);
    expect(d.tier).toBe(2);
  });
  test("4 of 5 marked → tier 3 (80%)", () => {
    expect(activityFor(mkState({ [MON]: { a: P, b: P, c: P, d: A } }), MON).tier).toBe(3);
  });
  test("full day → tier 4", () => {
    expect(activityFor(mkState({ [MON]: { a: P, b: P, c: P, d: P, e: P } }), MON).tier).toBe(4);
  });
  test("extra classes beyond schedule cap at tier 4", () => {
    const logs = { [MON]: Object.fromEntries(["a", "b", "c", "d", "e", "x-1", "x-2"].map((k) => [k, P])) };
    const d = activityFor(mkState(logs as AppState["logs"]), MON);
    expect(d.marked).toBe(7);
    expect(d.tier).toBe(4);
  });
  test("Sunday with no classes → tier 0", () => {
    expect(activityFor(mkState({}), SUN).tier).toBe(0);
  });
  test("Sunday with extra-class marks still shows activity (tier 4)", () => {
    expect(activityFor(mkState({ [SUN]: { "x-1": P, "x-2": P, "x-3": P } }), SUN).tier).toBe(4);
  });
});

describe("buildHeatmapWeeks — window alignment", () => {
  const state = mkState({ [MON]: { a: P } });
  const cols = buildHeatmapWeeks(state, 18);
  test("18 columns of 7 days", () => {
    expect(cols.length).toBe(18);
    expect(cols.every((c) => c.length === 7)).toBe(true);
  });
  test("last column is the current week and contains today", () => {
    const last = cols[17];
    expect(last[0].iso < MON).toBe(true); // starts on or before today
    expect(last.some((d) => d.iso === MON)).toBe(true);
    expect(last[1].iso).toBe(MON); // Monday sits at row index 1 (Sun-first columns)
  });
  test("future days are empty placeholders", () => {
    const sat = cols[17][6];
    expect(sat.iso > MON).toBe(true);
    expect(sat.marked).toBe(0);
    expect(sat.tier).toBe(0);
  });
  test("today's cell carries its marks", () => {
    expect(cols[17][1].marked).toBe(1);
    expect(cols[17][1].tier).toBe(1); // 1/5 = 20% → tier 1
  });
});

describe("computeActivityStats — totals and streaks", () => {
  test("totals, active days and present rate inputs", () => {
    const logs: AppState["logs"] = {
      [MON]: { a: P, b: A, c: P },
      [SUN]: { "x-1": P },
    };
    const s = computeActivityStats(mkState(logs), 18);
    expect(s.totalMarks).toBe(4);
    expect(s.totalPresent).toBe(3);
    expect(s.activeDays).toBe(2);
  });
  test("current streak counts today when marked, Sundays are neutral", () => {
    // Sat 21st + Monday 23rd marked (Sunday between them ignored)
    const logs: AppState["logs"] = {
      "2026-11-21": { a: P },
      [MON]: { a: P },
    };
    const s = computeActivityStats(mkState(logs), 18);
    expect(s.currentStreak).toBe(2);
    expect(s.longestStreak).toBe(2);
  });
  test("grace: today unmarked does not break a streak that ends yesterday", () => {
    const logs: AppState["logs"] = { "2026-11-21": { a: P } }; // Saturday only
    expect(computeActivityStats(mkState(logs), 18).currentStreak).toBe(1);
  });
  test("a missed non-Sunday day breaks the streak", () => {
    const logs: AppState["logs"] = {
      "2026-11-16": { a: P }, // Monday last week
      [MON]: { a: P },        // today — Tuesday..Friday gap breaks it
    };
    const s = computeActivityStats(mkState(logs), 18);
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(1);
  });
  test("empty logs → zeroed stats", () => {
    const s = computeActivityStats(mkState({}), 18);
    expect(s.totalMarks).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
  });
});
