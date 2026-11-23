// AttendMate Pro — official NSMCH Phase-III (Part-2) data + types.
// Ported verbatim from the original single-file app so the numbers stay identical.

export type MarkStatus = "present" | "absent" | "cancelled";

export interface SlotEntry {
  status: MarkStatus;
  subject?: string; // 'CP' = clinical posting (credited department resolved separately)
  kind?: "theory" | "clinical";
  custom?: boolean;
}

export interface Subject {
  code: string;
  name: string;
  lecture: number;
  sgl: number;
  sdl: number;
  total: number;
  clinicalWeeks: number;
  weeklySlots: number;
  color: string;
}

export const SUBJECTS: Subject[] = [
  { code: "IM", name: "General Medicine", lecture: 95, sgl: 130, sdl: 55, total: 280, clinicalWeeks: 14, weeklySlots: 5, color: "#a855f7" },
  { code: "SU", name: "General Surgery", lecture: 80, sgl: 140, sdl: 40, total: 260, clinicalWeeks: 10, weeklySlots: 5, color: "#eab308" },
  { code: "OG", name: "Obs-Gynae", lecture: 80, sgl: 140, sdl: 40, total: 260, clinicalWeeks: 10, weeklySlots: 5, color: "#0ea5e9" },
  { code: "PE", name: "Pediatrics", lecture: 30, sgl: 60, sdl: 30, total: 120, clinicalWeeks: 5, weeklySlots: 2, color: "#f59e0b" },
  { code: "OR", name: "Orthopaedics + PMR", lecture: 25, sgl: 35, sdl: 25, total: 85, clinicalWeeks: 4, weeklySlots: 2, color: "#22c55e" },
  { code: "AETCOM", name: "AETCOM Module", lecture: 30, sgl: 0, sdl: 22, total: 52, clinicalWeeks: 0, weeklySlots: 1, color: "#8b5cf6" },
  { code: "DR", name: "Dermatology, Venereology & Leprosy", lecture: 15, sgl: 10, sdl: 15, total: 40, clinicalWeeks: 2, weeklySlots: 0.5, color: "#ec4899" },
  { code: "PS", name: "Psychiatry", lecture: 15, sgl: 15, sdl: 15, total: 45, clinicalWeeks: 4, weeklySlots: 0.5, color: "#14b8a6" },
  { code: "EN", name: "Otorhinolaryngology (ENT)", lecture: 15, sgl: 25, sdl: 15, total: 55, clinicalWeeks: 4, weeklySlots: 1, color: "#f97316" },
  { code: "OP", name: "Ophthalmology", lecture: 15, sgl: 25, sdl: 15, total: 55, clinicalWeeks: 4, weeklySlots: 1, color: "#fb7185" },
  { code: "RD", name: "Radiodiagnosis & Radiotherapy", lecture: 8, sgl: 15, sdl: 15, total: 38, clinicalWeeks: 2, weeklySlots: 0.5, color: "#8b5cf6" },
  { code: "AN", name: "Anesthesiology", lecture: 8, sgl: 15, sdl: 15, total: 38, clinicalWeeks: 3, weeklySlots: 0.5, color: "#06b6d4" },
  { code: "PM", name: "Pandemic Module", lecture: 28, sgl: 0, sdl: 0, total: 28, clinicalWeeks: 0, weeklySlots: 1, color: "#64748b" },
];
export const SUBJECT_MAP: Record<string, Subject> = Object.fromEntries(
  SUBJECTS.map((s) => [s.code, s]),
);

export interface SubgroupRange { group: string; sub: string; min: number; max: number }
export const SUBGROUP_RANGES: SubgroupRange[] = [
  { group: "A", sub: "A1", min: 1, max: 4 }, { group: "A", sub: "A2", min: 5, max: 8 },
  { group: "A", sub: "A3", min: 9, max: 12 }, { group: "A", sub: "A4", min: 13, max: 16 },
  { group: "B", sub: "B1", min: 17, max: 20 }, { group: "B", sub: "B2", min: 21, max: 24 },
  { group: "B", sub: "B3", min: 25, max: 28 }, { group: "B", sub: "B4", min: 29, max: 32 },
  { group: "C", sub: "C1", min: 33, max: 36 }, { group: "C", sub: "C2", min: 37, max: 40 },
  { group: "C", sub: "C3", min: 41, max: 44 }, { group: "C", sub: "C4", min: 45, max: 49 },
  { group: "D", sub: "D1", min: 50, max: 53 }, { group: "D", sub: "D2", min: 54, max: 57 },
  { group: "D", sub: "D3", min: 58, max: 61 }, { group: "D", sub: "D4", min: 62, max: 66 },
  { group: "E", sub: "E1", min: 67, max: 70 }, { group: "E", sub: "E2", min: 71, max: 74 },
  { group: "E", sub: "E3", min: 75, max: 78 }, { group: "E", sub: "E4", min: 79, max: 83 },
  { group: "F", sub: "F1", min: 84, max: 87 }, { group: "F", sub: "F2", min: 88, max: 91 },
  { group: "F", sub: "F3", min: 92, max: 95 }, { group: "F", sub: "F4", min: 96, max: 100 },
];

export interface Slot { id: string; time: string; subject: string; altSubject?: string; label: string; type: "theory" | "clinical" }
/** Master weekly timetable — 1 = Mon … 6 = Sat */
export const MASTER_TIMETABLE: Record<number, Slot[]> = {
  1: [
    { id: "mon-09", time: "09:00 – 10:00", subject: "OG", label: "Obstetrics & Gynaecology (OG)", type: "theory" },
    { id: "mon-cp", time: "10:00 – 13:00", subject: "CP", label: "Clinical Posting", type: "clinical" },
    { id: "mon-14", time: "14:00 – 15:00", subject: "EN", label: "Otorhinolaryngology (EN)", type: "theory" },
    { id: "mon-15", time: "15:00 – 16:00", subject: "IM", label: "General Medicine (IM) — Lecture/SGD/Skill", type: "theory" },
    { id: "mon-16", time: "16:00 – 17:00", subject: "IM", label: "General Medicine (IM) — Lecture/SGD/Skill", type: "theory" },
  ],
  2: [
    { id: "tue-09", time: "09:00 – 10:00", subject: "PS", altSubject: "DR", label: "Psychiatry (PS) / Dermatology (DR)", type: "theory" },
    { id: "tue-cp", time: "10:00 – 13:00", subject: "CP", label: "Clinical Posting", type: "clinical" },
    { id: "tue-14", time: "14:00 – 15:00", subject: "OR", label: "Orthopedics (OR)", type: "theory" },
    { id: "tue-15", time: "15:00 – 16:00", subject: "OG", label: "Obstetrics & Gynaecology (OG) — Lecture/SGD/Skill", type: "theory" },
    { id: "tue-16", time: "16:00 – 17:00", subject: "OG", label: "Obstetrics & Gynaecology (OG) — Lecture/SGD/Skill", type: "theory" },
  ],
  3: [
    { id: "wed-09", time: "09:00 – 10:00", subject: "IM", label: "General Medicine (IM)", type: "theory" },
    { id: "wed-cp", time: "10:00 – 13:00", subject: "CP", label: "Clinical Posting", type: "clinical" },
    { id: "wed-14", time: "14:00 – 15:00", subject: "RD", altSubject: "AN", label: "Radiodiagnosis (RD) / Anesthesiology (AN)", type: "theory" },
    { id: "wed-15", time: "15:00 – 16:00", subject: "OG", label: "Obstetrics & Gynaecology (OG)", type: "theory" },
    { id: "wed-16", time: "16:00 – 17:00", subject: "SU", label: "Gen. Surgery (SU)", type: "theory" },
  ],
  4: [
    { id: "thu-09", time: "09:00 – 10:00", subject: "PE", label: "Pediatrics (PE)", type: "theory" },
    { id: "thu-cp", time: "10:00 – 13:00", subject: "CP", label: "Clinical Posting", type: "clinical" },
    { id: "thu-14", time: "14:00 – 15:00", subject: "OG", label: "Obstetrics & Gynaecology (OG)", type: "theory" },
    { id: "thu-15", time: "15:00 – 16:00", subject: "SU", label: "Gen. Surgery (SU) — Lecture/SGD/Skill", type: "theory" },
    { id: "thu-16", time: "16:00 – 17:00", subject: "SU", label: "Gen. Surgery (SU) — Lecture/SGD/Skill", type: "theory" },
  ],
  5: [
    { id: "fri-09", time: "09:00 – 10:00", subject: "SU", label: "Gen. Surgery (SU)", type: "theory" },
    { id: "fri-cp", time: "10:00 – 13:00", subject: "CP", label: "Clinical Posting", type: "clinical" },
    { id: "fri-14", time: "14:00 – 15:00", subject: "IM", label: "General Medicine (IM)", type: "theory" },
    { id: "fri-15", time: "15:00 – 16:00", subject: "PE", label: "Pediatrics (PE)", type: "theory" },
    { id: "fri-16", time: "16:00 – 17:00", subject: "OP", label: "Ophthalmology (OP)", type: "theory" },
  ],
  6: [
    { id: "sat-09", time: "09:00 – 10:00", subject: "OR", label: "Orthopedics (OR)", type: "theory" },
    { id: "sat-cp", time: "10:00 – 13:00", subject: "CP", label: "Clinical Posting", type: "clinical" },
    { id: "sat-14", time: "14:00 – 15:00", subject: "SU", label: "Gen. Surgery (SU)", type: "theory" },
    { id: "sat-15", time: "15:00 – 16:00", subject: "IM", label: "General Medicine (IM)", type: "theory" },
    { id: "sat-16", time: "16:00 – 17:00", subject: "PM", label: "Pandemic Module", type: "theory" },
  ],
};

export type RosterRow = { start: string; end: string; note?: string } & Record<string, string[] | string | undefined>;
/** Clinical posting rosters — official NSMCH Phase-III (Part-2) dates */
export const MINOR_ROSTER: RosterRow[] = [
  { start: "2026-10-10", end: "2026-10-28", DR: ["A1"], RD: ["A2"], AN: ["A3"], PS: ["A4"] },
  { start: "2026-10-29", end: "2026-11-19", DR: ["A4"], RD: ["A1"], AN: ["A2"], PS: ["A3"] },
  { start: "2026-11-20", end: "2026-12-03", DR: ["A3"], RD: ["A4"], AN: ["A1"], PS: ["A2"] },
  { start: "2026-12-04", end: "2026-12-17", DR: ["A2"], RD: ["A3"], AN: ["A4"], PS: ["A1"] },
  { start: "2026-12-18", end: "2027-01-09", DR: ["F1"], RD: ["F2"], AN: ["F3"], PS: ["F4"] },
  { start: "2027-01-11", end: "2027-01-23", DR: ["F4"], RD: ["F1"], AN: ["F2"], PS: ["F3"] },
  { start: "2027-01-25", end: "2027-02-13", DR: ["F3"], RD: ["F4"], AN: ["F1"], PS: ["F2"] },
  { start: "2027-02-15", end: "2027-02-27", DR: ["F2"], RD: ["F3"], AN: ["F4"], PS: ["F1"] },
  { start: "2027-03-01", end: "2027-03-13", DR: ["E1"], RD: ["E2"], AN: ["E3"], PS: ["E4"] },
  { start: "2027-03-22", end: "2027-04-03", DR: ["E4"], RD: ["E1"], AN: ["E2"], PS: ["E3"] },
  { start: "2027-04-05", end: "2027-04-17", DR: ["E3"], RD: ["E4"], AN: ["E1"], PS: ["E2"] },
  { start: "2027-04-19", end: "2027-05-01", DR: ["E2"], RD: ["E3"], AN: ["E4"], PS: ["E1"] },
  { start: "2027-05-03", end: "2027-05-15", DR: ["D1"], RD: ["D2"], AN: ["D3"], PS: ["D4"] },
  { start: "2027-05-17", end: "2027-05-31", DR: ["D4"], RD: ["D1"], AN: ["D2"], PS: ["D3"] },
  { start: "2027-06-10", end: "2027-06-23", DR: ["D3"], RD: ["D4"], AN: ["D1"], PS: ["D2"] },
  { start: "2027-06-24", end: "2027-07-07", DR: ["D2"], RD: ["D3"], AN: ["D4"], PS: ["D1"] },
  { start: "2027-07-08", end: "2027-07-24", DR: ["C1"], RD: ["C2"], AN: ["C3"], PS: ["C4"] },
  { start: "2027-08-02", end: "2027-08-14", DR: ["C4"], RD: ["C1"], AN: ["C2"], PS: ["C3"] },
  { start: "2027-08-16", end: "2027-08-28", DR: ["C3"], RD: ["C4"], AN: ["C1"], PS: ["C2"] },
  { start: "2027-09-06", end: "2027-09-18", DR: ["C2"], RD: ["C3"], AN: ["C4"], PS: ["C1"] },
  { start: "2027-09-20", end: "2027-10-02", DR: ["B1"], RD: ["B2"], AN: ["B3"], PS: ["B4"] },
  { start: "2027-10-04", end: "2027-10-20", DR: ["B4"], RD: ["B1"], AN: ["B2"], PS: ["B3"] },
  { start: "2027-10-21", end: "2027-11-13", DR: ["B3"], RD: ["B4"], AN: ["B1"], PS: ["B2"] },
  { start: "2027-11-15", end: "2027-11-27", DR: ["B2"], RD: ["B3"], AN: ["B4"], PS: ["B1"] },
];
export const MID_ROSTER: RosterRow[] = [
  { start: "2026-10-10", end: "2026-11-19", PE: ["B1", "B2"], OR: ["B3", "B4"], EN: ["C1", "C2"], OP: ["C3", "C4"] },
  { start: "2026-11-20", end: "2026-12-17", PE: ["B3", "B4"], OR: ["B1", "B2"], EN: ["C3", "C4"], OP: ["C1", "C2"] },
  { start: "2026-12-18", end: "2027-01-23", PE: ["A1", "A2"], OR: ["A3", "A4"], EN: ["B1", "B2"], OP: ["B3", "B4"] },
  { start: "2027-01-25", end: "2027-02-27", PE: ["A3", "A4"], OR: ["A1", "A2"], EN: ["B3", "B4"], OP: ["B1", "B2"] },
  { start: "2027-03-01", end: "2027-04-03", PE: ["F1", "F2"], OR: ["F3", "F4"], EN: ["A1", "A2"], OP: ["A3", "A4"] },
  { start: "2027-04-05", end: "2027-05-01", PE: ["F3", "F4"], OR: ["F1", "F2"], EN: ["A3", "A4"], OP: ["A1", "A2"] },
  { start: "2027-05-03", end: "2027-05-31", PE: ["E1", "E2"], OR: ["E3", "E4"], EN: ["F1", "F2"], OP: ["F3", "F4"] },
  { start: "2027-06-10", end: "2027-07-07", PE: ["E3", "E4"], OR: ["E1", "E2"], EN: ["F3", "F4"], OP: ["F1", "F2"] },
  { start: "2027-07-08", end: "2027-08-14", PE: ["D1", "D2"], OR: ["D3", "D4"], EN: ["E1", "E2"], OP: ["E3", "E4"] },
  { start: "2027-08-16", end: "2027-09-18", PE: ["D3", "D4"], OR: ["D1", "D2"], EN: ["E3", "E4"], OP: ["E1", "E2"] },
  { start: "2027-09-20", end: "2027-10-20", PE: ["C1", "C2"], OR: ["C3", "C4"], EN: ["D1", "D2"], OP: ["D3", "D4"] },
  { start: "2027-10-21", end: "2027-11-27", PE: ["C3", "C4"], OR: ["C1", "C2"], EN: ["D3", "D4"], OP: ["D1", "D2"] },
];
export const MAJOR_ROSTER: RosterRow[] = [
  { start: "2026-10-10", end: "2026-12-17", IM: ["D"], SU: ["E"], OG: ["F"] },
  { start: "2026-12-18", end: "2027-02-27", IM: ["C"], SU: ["D"], OG: ["E"] },
  { start: "2027-03-01", end: "2027-05-01", IM: ["B"], SU: ["C"], OG: ["D"] },
  { start: "2027-05-03", end: "2027-07-07", IM: ["A"], SU: ["B"], OG: ["C"] },
  { start: "2027-07-08", end: "2027-09-18", IM: ["F"], SU: ["A"], OG: ["B"] },
  { start: "2027-09-20", end: "2027-11-27", IM: ["E"], SU: ["F"], OG: ["A"] },
];
export const EXAM_CLINICAL_ROSTER: RosterRow[] = [
  { start: "2027-11-29", end: "2027-12-04", IM: ["A", "B"], SU: ["C", "D"], OG: ["E", "F"], note: "Exam Oriented Clinical Class" },
  { start: "2027-12-06", end: "2027-12-10", IM: ["E", "F"], SU: ["A", "B"], OG: ["C", "D"], note: "Exam Oriented Clinical Class" },
  { start: "2028-01-03", end: "2028-01-08", IM: ["C", "D"], SU: ["E", "F"], OG: ["A", "B"], note: "Exam Oriented Clinical Class" },
];
export const DEPT_NAMES: Record<string, string> = {
  DR: "Dermatology, Venereology & Leprosy", RD: "Radiodiagnosis & Radiotherapy",
  AN: "Anesthesiology", PS: "Psychiatry", PE: "Pediatrics", OR: "Orthopaedics + PMR",
  EN: "Otorhinolaryngology (ENT)", OP: "Ophthalmology", IM: "General Medicine",
  SU: "General Surgery", OG: "Obs-Gynae",
};

export interface ModuleInfo { id: string; title: string; hours: string; dept: string; topic: string }
export const AETCOM_MODULES: ModuleInfo[] = [
  { id: "4.1", title: "4.1 (A & B): The Foundation of Communication-5", hours: "5 hrs (1+2+2)", dept: "General Medicine and Allied Subjects", topic: "A: Demonstrate ability to communicate to patients in a patient, respectful, nonthreatening, non-judgmental and empathetic manner. B: Communicate diagnostic and therapeutic options to patient and family in a simulated environment." },
  { id: "4.2", title: "4.2: Case Studies in Medico-legal and Ethical Situations", hours: "6 hrs (1+3-SDL+1+1)", dept: "Obs/ Gynaecology", topic: "Identify, discuss and defend medico-legal, socioeconomic and ethical issues as it pertains to abortion / Medical Termination of Pregnancy and reproductive rights." },
  { id: "4.3", title: "4.3: Case Studies in Medico-legal and Ethical Situations", hours: "6 hrs (1+3-SDL+1+1)", dept: "General Medicine and Allied Subjects", topic: "Identify and discuss medico-legal, socio-economic and ethical issues as it pertains to organ donation." },
  // source: AETCOM Phase-III, Module 4.4 (NMC AETCOM book, professional year 4):
  // competencies "Demonstrate empathy in patient encounters" + "Communicate care
  // options to patient and family with a terminal illness in a simulated environment".
  // NOTE: the central book allocates 5 hrs (1+2-SDL+1+1); the college schedule
  // transcribed here allocates 6 (1+3-SDL+1+1) — kept, flagged per ground rules.
  { id: "4.4", title: "4.4 (A & B): Case Studies in Ethics, Empathy & Doctor-Patient Relationship", hours: "6 hrs (1+3-SDL+1+1)", dept: "General Surgery and Allied Subjects", topic: "A: Demonstrate empathy in patient encounters. B: Communicate care options to patient and family with a terminal illness in a simulated environment." },
  // source: AETCOM Phase-III, Module 4.5 — "Identify and discuss and defend
  // medico-legal, socio-cultural, professional and ethical issues in
  // physician-industry relationships" (wording aligned to the book).
  { id: "4.5", title: "4.5: Case Studies in Ethics: The Doctor-Industry Relationship", hours: "6 hrs (1+3-SDL+1+1)", dept: "General Surgery and Allied Subjects", topic: "Identify and discuss and defend medico-legal, socio-cultural, professional and ethical issues in physician-industry relationships." },
  // source: AETCOM Phase-III, Module 4.6 — title in the book is "Case studies in
  // ethics and the doctor-industry relationship"; competency below is verbatim.
  { id: "4.6", title: "4.6: Case Studies in Ethics and the Doctor-Industry Relationship", hours: "6 hrs (1+3-SDL+1+1)", dept: "General Surgery and Allied Subjects", topic: "Identify conflicts of interest in patient care and professional relationships and describe the correct response to these conflicts." },
  // source: AETCOM Phase-III, Module 4.7 — the book's competency for this module
  // is VERBATIM the same sentence as 4.6's ("Identify conflicts of interest...").
  // The apparent duplication is in the handbook itself, not a copy-paste error.
  { id: "4.7", title: "4.7: Case Studies in Ethics and Patient Autonomy", hours: "6 hrs (1+3-SDL+1+1)", dept: "Obs/ Gynaecology", topic: "Identify conflicts of interest in patient care and professional relationships and describe the correct response to these conflicts." },
  // source: AETCOM Phase-III, Module 4.8 "Dealing with death" — the book lists
  // two competencies: (1) the conflicts-of-interest sentence, (2) "Demonstrate
  // empathy to patient and family with a terminal illness in a simulated
  // environment". A/B below transcribe them verbatim.
  { id: "4.8", title: "4.8 (A & B): Dealing with Death", hours: "6 hrs (1+3-SDL+1+1)", dept: "Obs/ Gynaecology", topic: "A: Identify conflicts of interest in patient care and professional relationships and describe the correct response to these conflicts. B: Demonstrate empathy to patient and family with a terminal illness in a simulated environment." },
  // source: AETCOM Phase-III, Module 4.9 "Medical negligence".
  { id: "4.9", title: "4.9 (A & B): Medical Negligence", hours: "5 hrs (1+3-SDL+1)", dept: "Paediatrics", topic: "A: Identify, discuss and defend medico-legal, socio-cultural, professional and ethical issues pertaining to medical negligence. B: Identify, discuss and defend medico-legal, socio-cultural, professional and ethical issues pertaining to malpractice." },
];
export const PANDEMIC_MODULES: ModuleInfo[] = [
  { id: "P4.1", title: "Module 4.1 — Triage Concept", hours: "6 Hrs (2+1+2+1)", dept: "General Medicine", topic: "Care of patients during pandemics: Triage concept" },
  { id: "P4.2", title: "Module 4.2 — Resuscitation", hours: "8 hrs (2+4+1+1)", dept: "Anaesthesiology", topic: "Emergency procedures during pandemics: Resuscitation" },
  { id: "P4.3", title: "Module 4.3 — Managing Death", hours: "2 hrs (1+1)", dept: "Anaesthesiology", topic: "Managing death during pandemics" },
  { id: "P4.4", title: "Module 4.4 — Information Management", hours: "4 hrs (2+1+1)", dept: "General Medicine", topic: "Information management during pandemics" },
  { id: "P4.5", title: "Module 4.5 — Intensive Care Management", hours: "4 hrs (1+1+1+1)", dept: "Anaesthesiology", topic: "Intensive care management during pandemics" },
  { id: "P4.6", title: "Module 4.6 — Palliative Care", hours: "4 hrs (1+1+1+1)", dept: "General Medicine", topic: "Palliative Care during pandemics" },
  { id: "P4.7", title: "Module 4.7 — Mental Health Issues", hours: "4 hrs (1+1+1+1)", dept: "Psychiatry", topic: "Mental Health Issues During Pandemic" },
];

export interface ExamInfo { id: string; name: string; subjects: string; start: string; end: string }
export const EXAMS: ExamInfo[] = [
  { id: "ia1a", name: "1st (A) Internal Assessment", subjects: "General Medicine, General Surgery, Obstetrics and Gynecology", start: "2027-02-01", end: "2027-02-06" },
  { id: "ia1b", name: "1st (B) Internal Assessment", subjects: "Pediatrics, Ophthalmology & ENT", start: "2027-03-15", end: "2027-03-20" },
  { id: "ia2a", name: "2nd (A) Internal Assessment", subjects: "General Medicine, General Surgery, Obstetrics and Gynecology", start: "2027-07-26", end: "2027-07-31" },
  { id: "ia2b", name: "2nd (B) Internal Assessment", subjects: "Pediatrics, Ophthalmology & ENT", start: "2027-08-30", end: "2027-09-04" },
  { id: "sentup", name: "Sentup / Pre-University Exam", subjects: "General Medicine, General Surgery (25% Orthopedics), Obstetrics and Gynecology, Pediatrics, Ophthalmology & ENT", start: "2027-12-11", end: "2027-12-24" },
];

export interface Profile {
  name: string; email: string; rollNo: number;
  theoryTarget: number; clinicalTarget: number; theme: "light" | "dark";
}
export interface Baseline { theoryPresent?: number; theoryTotal?: number; clinicalPresent?: number; clinicalTotal?: number }
export interface AppState {
  profile: Profile;
  logs: Record<string, Record<string, SlotEntry>>; // date -> slotId -> entry
  baseline: Record<string, Baseline>;
  aetcomDone: Record<string, boolean>;
  pandemicDone: Record<string, boolean>;
  selectedDate: string;
  activeTab: string;
  subjMode: "theory" | "clinical";
  /** Server user id this device copy belongs to; null/undefined = guest / device-only data. */
  syncOwnerId?: string | null;
}
export const STORAGE_KEY = "attendmate_pro_v2";
export const SESSION_END = "2027-12-24"; // Sentup exam end — projection horizon
