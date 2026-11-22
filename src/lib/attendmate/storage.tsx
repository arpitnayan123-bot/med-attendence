"use client";
// AttendMate Pro — client state: localStorage persistence (schema-compatible
// with the original app's attendmate_pro_v2), 40-step undo, theme handling.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { AppState, STORAGE_KEY, SlotEntry, MarkStatus, MASTER_TIMETABLE } from "./data";
import { todayISO, getClinicalPostingForDate, shiftDate } from "./engine";

function MASTER_SLOTS(dow: number) { return MASTER_TIMETABLE[dow] || []; }
function resolvePostingCached(iso: string, subGroup: string): string | null {
  return getClinicalPostingForDate(iso, subGroup)?.code || null;
}
function shift(iso: string, delta: number) { return shiftDate(iso, delta); }

export function createDefaultState(): AppState {
  return {
    profile: { name: "", email: "", rollNo: 1, theoryTarget: 75, clinicalTarget: 80, theme: "light" },
    logs: {},
    baseline: {},
    aetcomDone: {},
    pandemicDone: {},
    selectedDate: todayISO(),
    activeTab: "today",
    subjMode: "theory",
  };
}

function loadStored(): AppState {
  const base = createDefaultState();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...base,
        ...parsed,
        profile: { ...base.profile, ...(parsed.profile || {}) },
        logs: parsed.logs || {},
        baseline: parsed.baseline || {},
        aetcomDone: parsed.aetcomDone || {},
        pandemicDone: parsed.pandemicDone || {},
      };
    }
  } catch { /* fall back to defaults */ }
  return base;
}

export function saveStored(state: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

export function isSignedIn(state: AppState): boolean {
  return Boolean(state.profile.name && state.profile.email);
}

/* theme shared with the static site via attendmate_site_theme */
export function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    const t = localStorage.getItem("attendmate_site_theme");
    if (t === "dark" || t === "light") return t;
  } catch { /* ignore */ }
  return "light";
}
export function applyThemeClass(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export interface UndoSnapshot { label: string; state: AppState }

export interface AttendMateCtx {
  state: AppState;
  setState: (updater: (prev: AppState) => AppState, undoLabel?: string) => void;
  markSlot: (iso: string, slotId: string, status: MarkStatus, subject?: string, kind?: "theory" | "clinical") => void;
  bulkMarkDay: (iso: string, status: MarkStatus, subGroup?: string) => void;
  copyPreviousDay: (iso: string) => void;
  addExtraClass: (iso: string, subject: string, kind: "theory" | "clinical") => void;
  removeSlot: (iso: string, slotId: string) => void;
  bulkFill: (from: string, to: string, status: MarkStatus, subGroup: string) => void;
  undo: () => void;
  canUndo: boolean;
  lastAction: string | null;
  lastActionAt: number;
  resetAll: () => void;
  importState: (json: string) => boolean;
  setTheme: (theme: "light" | "dark") => void;
}
const Ctx = createContext<AttendMateCtx | null>(null);

export function AttendMateProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(() => createDefaultState());
  const [canUndo, setCanUndo] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastActionAt, setLastActionAt] = useState(0);
  const undoRef = useRef<UndoSnapshot[]>([]);
  const hydrated = useRef(false);
  const stateRef = useRef<AppState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const note = useCallback((label: string) => {
    setLastAction(label);
    setLastActionAt(Date.now());
  }, []);

  useEffect(() => {
    const loaded = loadStored();
    const theme = getStoredTheme();
    applyThemeClass(theme);
    // One-time rehydration from localStorage (external system). SSR rendered
    // the default state; this sync must happen post-mount to avoid mismatches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStateRaw({ ...loaded, profile: { ...loaded.profile, theme } });
    hydrated.current = true;
  }, []);

  const persist = useCallback((next: AppState) => {
    saveStored(next);
    setCanUndo(undoRef.current.length > 0);
  }, []);

  const setState = useCallback((updater: (prev: AppState) => AppState, undoLabel?: string) => {
    setStateRaw((prev) => {
      if (undoLabel) {
        undoRef.current.push({ label: undoLabel, state: prev });
        if (undoRef.current.length > 40) undoRef.current.shift();
      }
      const next = updater(prev);
      persist(next);
      return next;
    });
    if (undoLabel) note(undoLabel);
  }, [persist, note]);

  const markSlot = useCallback((iso: string, slotId: string, status: MarkStatus, subject?: string, kind?: "theory" | "clinical") => {
    setState((prev) => {
      const dayLog = { ...(prev.logs[iso] || {}) };
      const entry: SlotEntry = { status, ...(subject ? { subject } : {}), ...(kind ? { kind } : {}) };
      dayLog[slotId] = entry;
      return { ...prev, logs: { ...prev.logs, [iso]: dayLog } };
    }, `Mark ${slotId}`);
  }, [setState]);

  const bulkMarkDay = useCallback((iso: string, status: MarkStatus, subGroup?: string) => {
    setState((prev) => {
      const dow = new Date(iso + "T12:00:00").getDay();
      const dayLog: Record<string, SlotEntry> = {};
      for (const s of MASTER_SLOTS(dow)) {
        if (status === "present" && s.type === "clinical" && subGroup) {
          const posting = resolvePostingCached(iso, subGroup);
          dayLog[s.id] = { status, subject: posting || "CP", kind: "clinical" };
        } else {
          dayLog[s.id] = { status, subject: s.subject };
        }
      }
      return { ...prev, logs: { ...prev.logs, [iso]: dayLog } };
    }, `Mark all ${iso}`);
  }, [setState]);

  const copyPreviousDay = useCallback((iso: string) => {
    setState((prev) => {
      const prevIso = shift(iso, -1);
      const src = prev.logs[prevIso];
      if (!src) return prev;
      const dow = new Date(iso + "T12:00:00").getDay();
      const valid = new Set(dow !== 0 ? MASTER_SLOTS(dow).map((s) => s.id) : []);
      const dayLog: Record<string, SlotEntry> = {};
      for (const id of Object.keys(src)) if (valid.has(id)) dayLog[id] = { ...src[id] };
      return { ...prev, logs: { ...prev.logs, [iso]: dayLog } };
    }, "Copy previous day");
  }, [setState]);

  const addExtraClass = useCallback((iso: string, subject: string, kind: "theory" | "clinical") => {
    setState((prev) => {
      const dayLog = { ...(prev.logs[iso] || {}) };
      const id = `x-${Date.now().toString(36)}`;
      dayLog[id] = { status: "present", subject, kind, custom: true };
      return { ...prev, logs: { ...prev.logs, [iso]: dayLog } };
    }, "Add extra class");
  }, [setState]);

  const removeSlot = useCallback((iso: string, slotId: string) => {
    setState((prev) => {
      const dayLog = { ...(prev.logs[iso] || {}) };
      delete dayLog[slotId];
      return { ...prev, logs: { ...prev.logs, [iso]: dayLog } };
    }, "Remove entry");
  }, [setState]);

  const bulkFill = useCallback((from: string, to: string, status: MarkStatus, subGroup: string) => {
    let n = 0;
    let probe = from;
    while (probe <= to) {
      const dow = new Date(probe + "T12:00:00").getDay();
      if (dow !== 0 && !stateRef.current.logs[probe]) n++;
      probe = shift(probe, 1);
    }
    setState((prev) => {
      const logs = { ...prev.logs };
      let d = from;
      while (d <= to) {
        const dow = new Date(d + "T12:00:00").getDay();
        if (dow !== 0 && !logs[d]) {
          const dayLog: Record<string, SlotEntry> = {};
          for (const s of MASTER_SLOTS(dow)) {
            if (status === "present" && s.type === "clinical" && subGroup) {
              const posting = resolvePostingCached(d, subGroup);
              dayLog[s.id] = { status, subject: posting || "CP", kind: "clinical" };
            } else {
              dayLog[s.id] = { status, subject: s.subject };
            }
          }
          logs[d] = dayLog;
        }
        d = shift(d, 1);
      }
      return { ...prev, logs };
    }, "Bulk fill");
    note(`Bulk-filled ${n} day${n === 1 ? "" : "s"}`);
  }, [setState, note]);

  const undo = useCallback(() => {
    const snap = undoRef.current.pop();
    if (!snap) return;
    setStateRaw(snap.state);
    persist(snap.state);
    setCanUndo(undoRef.current.length > 0);
    note("Last action undone");
  }, [persist, note]);

  const resetAll = useCallback(() => {
    setState(() => createDefaultState(), "Reset");
  }, [setState]);

  const importState = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== "object" || !parsed.profile) return false;
      setState(() => ({ ...createDefaultState(), ...parsed, profile: { ...createDefaultState().profile, ...(parsed.profile || {}) } }), "Import backup");
      return true;
    } catch { return false; }
  }, [setState]);

  const setTheme = useCallback((theme: "light" | "dark") => {
    applyThemeClass(theme);
    try { localStorage.setItem("attendmate_site_theme", theme); } catch { /* ignore */ }
    setState((prev) => ({ ...prev, profile: { ...prev.profile, theme } }));
  }, [setState]);

  const value = useMemo<AttendMateCtx>(() => ({
    state, setState, markSlot, bulkMarkDay, copyPreviousDay, addExtraClass, removeSlot,
    bulkFill, undo, canUndo, lastAction, lastActionAt, resetAll, importState, setTheme,
  }), [state, setState, markSlot, bulkMarkDay, copyPreviousDay, addExtraClass, removeSlot, bulkFill, undo, canUndo, lastAction, lastActionAt, resetAll, importState, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAttendMate(): AttendMateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAttendMate must be used inside AttendMateProvider");
  return ctx;
}
