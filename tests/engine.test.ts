// Unit tests for the core attendance engine (dates, bunk math, day summaries,
// streaks, skip advice). Run: bun test tests/engine.test.ts
import { describe, test, expect } from "bun:test";
import { AppState, SlotEntry } from "../src/lib/attendmate/data";
import { SUBJECT_MAP, Subject } from "../src/lib/attendmate/data";
import {
  shiftDate, daysBetween, getGroupInfo, calcBunkInfo, daySummary,
  streakInfo, classifySkipPriority,
} from "../src/lib/attendmate/engine";

const P = (subj = "IM", kind: "theory" | "clinical" = "theory"): SlotEntry =>
  ({ status: "present", subject: subj, kind, custom: false });
const A = (subj = "IM"): SlotEntry => ({ status: "absent", subject: subj, kind: "theory", custom: false });
const X = (subj = "IM"): SlotEntry => ({ status: "cancelled", subject: subj, kind: "theory", custom: false });
function mkState(logs: AppState["logs"]): AppState {
  return { logs } as unknown as AppState;
}

describe("date helpers", () => {
  test("shiftDate crosses month and year boundaries", () => {
    expect(shiftDate("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2026-03-15", -15)).toBe("2026-02-28");
  });
  test("daysBetween is signed and exact", () => {
    expect(daysBetween("2026-11-16", "2026-11-23")).toBe(7);
    expect(daysBetween("2026-11-23", "2026-11-16")).toBe(-7);
  });
});

describe("getGroupInfo — official sub-group mapping", () => {
  test("known roster points", () => {
    expect(getGroupInfo(35).subGroup).toBe("C1");
    expect(getGroupInfo(35).group).toBe("C");
  });
  test("clamps out-of-range rolls into 1..100", () => {
    expect(getGroupInfo(0).rollNo).toBe(1);
    expect(getGroupInfo(500).rollNo).toBe(100);
  });
});

describe("calcBunkInfo — safe-bunk arithmetic", () => {
  test("no classes logged → empty", () => {
    const b = calcBunkInfo(0, 0, 75);
    expect(b.status).toBe("empty");
    expect(b.canBunk).toBe(0);
  });
  test("80% at 75% target → 3 safe skips", () => {
    const b = calcBunkInfo(40, 50, 75);
    expect(b.status).toBe("safe");
    expect(b.canBunk).toBe(3);
    expect(b.mustAttend).toBe(0);
  });
  test("exactly on target → borderline, 0 skips", () => {
    const b = calcBunkInfo(45, 60, 75);
    expect(b.canBunk).toBe(0);
    expect(b.status).toBe("borderline");
  });
  test("60% at 75% target → must attend 30", () => {
    const b = calcBunkInfo(30, 50, 75);
    expect(b.status).toBe("danger");
    expect(b.mustAttend).toBe(30);
  });
});

describe("daySummary — slot counting", () => {
  const MON = "2026-11-23"; // Monday: 5 master slots
  test("mixed statuses incl. extra class and unlogged slot", () => {
    const logs: AppState["logs"] = {
      [MON]: {
        "mon-09": P("OG"), "mon-cp": P("CP", "clinical"),
        "mon-14": A("EN"), "mon-15": X("IM"), "x-1": P("IM"),
      },
    };
    const d = daySummary(mkState(logs), MON);
    expect(d.totalSlots).toBe(6);            // 5 master + 1 custom
    expect(d.present).toBe(3);
    expect(d.absent).toBe(1);
    expect(d.cancelled).toBe(1);
    expect(d.unlogged).toBe(1);              // mon-16 left unmarked
    expect(d.logged).toBe(5);
    expect(d.judged).toBe(4);                // present + absent only
    expect(d.pct).toBe(75);
    expect(d.isHoliday).toBe(false);
  });
  test("all cancelled → holiday", () => {
    const logs: AppState["logs"] = {
      [MON]: Object.fromEntries(["mon-09", "mon-cp", "mon-14", "mon-15", "mon-16"].map((id) => [id, X()])),
    } as AppState["logs"];
    expect(daySummary(mkState(logs), MON).isHoliday).toBe(true);
  });
  test("Sunday has no scheduled slots", () => {
    const d = daySummary(mkState({}), "2026-11-22");
    expect(d.dow).toBe(0);
    expect(d.totalSlots).toBe(0);
  });
});

describe("streakInfo — perfect-day streaks", () => {
  test("current and best streaks with today's grace", () => {
    // Sat 21st fully present, Mon 23rd fully present; Sunday neutral, today marked
    const logs: AppState["logs"] = {
      "2026-11-21": Object.fromEntries(["sat-09", "sat-cp", "sat-14", "sat-15", "sat-16"].map((id) => [id, P()])),
      "2026-11-23": Object.fromEntries(["mon-09", "mon-cp", "mon-14", "mon-15", "mon-16"].map((id) => [id, P()])),
    } as AppState["logs"];
    const s = streakInfo(mkState(logs));
    expect(s.current).toBe(2);               // today + Saturday (Sunday skipped)
    expect(s.best).toBe(2);
    expect(s.perfectDays).toBe(2);
  });
  test("an absence breaks the perfect run", () => {
    const logs: AppState["logs"] = {
      "2026-11-16": Object.fromEntries(["mon-09", "mon-cp", "mon-14", "mon-15", "mon-16"].map((id) => [id, P()])),
      "2026-11-17": { "tue-09": A() },        // imperfect day resets the run
    } as AppState["logs"];
    const s = streakInfo(mkState(logs));
    expect(s.best).toBe(1);
  });
});

describe("classifySkipPriority — advice tiers", () => {
  const lowFreq = SUBJECT_MAP["EN"] as Subject;   // 1 theory slot/week in the master timetable
  test("no data + low frequency → Don't Miss", () => {
    const p = classifySkipPriority(lowFreq, 0, 0, 75, "theory");
    expect(p.tier).toBe("dont");
  });
  test("danger zone → Don't Miss with attend-count reason", () => {
    const p = classifySkipPriority(lowFreq, 3, 10, 75, "theory");
    expect(p.tier).toBe("dont");
    expect(p.reason).toContain("Attend next");
  });
});
