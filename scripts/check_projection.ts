// P1-1 + P1-2 numeric check: projection null with zero data, sane with data;
// remaining schedule = timetable-derived counts minus Sundays and exam windows.
import { createDefaultState } from "../src/lib/attendmate/storage";
import { projectSessionEnd, todayISO, shiftDate, getDayOfWeek, PROJECTION_HORIZON, examDates } from "../src/lib/attendmate/engine";
import { AppState, SlotEntry } from "../src/lib/attendmate/data";

const fresh = createDefaultState();
const p0 = projectSessionEnd(fresh);
console.log("fresh profile:", JSON.stringify({ theory: p0.theory, clinical: p0.clinical, combined: p0.combined }));
if (p0.theory !== null || p0.clinical !== null || p0.combined !== null) {
  console.error("FAIL: fresh profile must show — for all three projections");
  process.exit(1);
}

// one mixed day: 3 present + 1 absent theory, clinical present
const st = createDefaultState();
const day: Record<string, SlotEntry> = {
  "sat-t1": { status: "present", subject: "IM" },
  "sat-t2": { status: "present", subject: "SU" },
  "sat-t3": { status: "absent", subject: "OG" },
  "sat-t4": { status: "present", subject: "IM" },
  "sat-cp": { status: "present", subject: "IM", kind: "clinical" },
};
st.logs["2026-11-14"] = day;
const p1 = projectSessionEnd(st);
console.log("one day:", JSON.stringify({
  theory: p1.theory?.toFixed(2), clinical: p1.clinical?.toFixed(2), combined: p1.combined?.toFixed(2), remT: p1.remT, remC: p1.remC,
}));
// projection must sit between the observed rate (theory 75%) and 100
const okTheory = p1.theory !== null && p1.theory >= 75 && p1.theory < 100;
const okClinical = p1.clinical === 100; // one perfect posting day → rate 100, projection stays 100
const okCombined = p1.combined !== null && p1.combined >= 80 && p1.combined <= 100;
if (!okTheory || !okClinical || !okCombined) { console.error("FAIL: projection should move sensibly"); process.exit(1); }
console.log("P1-1 OK: fresh → all null; mixed day → theory >75 & <100, clinical 100 (perfect rate), combined in range");

/* ---------- P1-2: remaining schedule = timetable minus Sundays/exams ---------- */
import { MASTER_TIMETABLE } from "../src/lib/attendmate/data";
const perDow: Record<number, { t: number; c: number }> = {};
for (let dow = 0; dow <= 6; dow++) {
  const slots = (MASTER_TIMETABLE[dow] || []) as { type: string }[];
  perDow[dow] = { t: slots.filter((s) => s.type !== "clinical").length, c: slots.filter((s) => s.type === "clinical").length };
}
// hand recomputation for the FRESH state (no logged days): every non-Sunday
// date from today to the horizon, minus assessment-window dates
const examSet = examDates();
let expT = 0, expC = 0, sundays = 0, examDays = 0;
let d = todayISO();
while (d <= PROJECTION_HORIZON) {
  const dow = getDayOfWeek(d);
  if (dow === 0) sundays++;
  else if (examSet.has(d)) examDays++;
  else { expT += perDow[dow].t; expC += perDow[dow].c; }
  d = shiftDate(d, 1);
}
console.log("horizon:", PROJECTION_HORIZON, "| sundays skipped:", sundays, "| exam days skipped:", examDays);
console.log("expected:", { expT, expC }, " engine:", { remT: p0.remT, remC: p0.remC });
if (p0.remT !== expT || p0.remC !== expC) { console.error("FAIL: remaining counts do not match hand recomputation"); process.exit(1); }
const weeklyT = [1, 2, 3, 4, 5, 6].reduce((a, dow) => a + perDow[dow].t, 0);
const weeklyC = [1, 2, 3, 4, 5, 6].reduce((a, dow) => a + perDow[dow].c, 0);
console.log("per-week from timetable:", { theorySlots: weeklyT, clinicalDays: weeklyC });
console.log("P1-2 OK: remaining = timetable slots per weekday × (non-Sunday, non-exam, unlogged) days to", PROJECTION_HORIZON);
