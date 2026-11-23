// P2-1: weekly hours must be computed from the timetable, not hard-coded.
import { MASTER_TIMETABLE } from "../src/lib/attendmate/data";
const slotHours = (s: { time: string }): number => {
  const [a, b] = s.time.split("–").map((t) => t.trim());
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
  return (toMin(b) - toMin(a)) / 60;
};
let th = 0, cl = 0;
for (let d = 1; d <= 6; d++) for (const s of MASTER_TIMETABLE[d] || []) { const h = slotHours(s); if (s.type === "clinical") cl += h; else th += h; }
console.log({ theoryHrs: th, clinicalHrs: cl });
if (th !== 24 || cl !== 18) { console.error("FAIL: expected 24 / 18"); process.exit(1); }
console.log("P2-1 OK: header will read 24 theory hrs · 18 clinical hrs per week");
