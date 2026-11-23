// P1-1 numeric check: projection must be null with zero data, sane with data.
import { createDefaultState } from "../src/lib/attendmate/storage";
import { projectSessionEnd } from "../src/lib/attendmate/engine";
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
