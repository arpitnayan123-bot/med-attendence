"use client";
// AttendMate Pro — client state + sync bridge.
// localStorage persistence (schema-compatible with the original app's
// attendmate_pro_v2), 40-step undo, theme handling, and a production sync
// layer: every mutation is diffed into keyed server ops, queued (offline-first)
// and flushed to /api/sync when an account is signed in.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { AppState, STORAGE_KEY, SlotEntry, MarkStatus, MASTER_TIMETABLE } from "./data";
import { todayISO, getClinicalPostingForDate, shiftDate } from "./engine";
import {
  SyncStatus, ServerOp, enqueueOps, readPendingOps, writePendingOps, pendingCount,
  clearQueue, pullAndMerge, apiMe, apiLogin, apiRegister, apiLogout, apiPush, apiWipeServerData,
} from "./sync";

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
    syncOwnerId: null,
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
        syncOwnerId: typeof parsed.syncOwnerId === "string" ? parsed.syncOwnerId : null,
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

/* ---------- mutation diffing → server ops ---------- */
const PROFILE_FIELDS = ["name", "email", "rollNo", "theoryTarget", "clinicalTarget", "theme"] as const;

function diffOps(prev: AppState, next: AppState): ServerOp[] {
  const ops: ServerOp[] = [];
  if (prev.logs !== next.logs) {
    const dates = new Set([...Object.keys(prev.logs), ...Object.keys(next.logs)]);
    for (const date of dates) {
      const a = prev.logs[date] || {};
      const b = next.logs[date] || {};
      const slots = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const slotId of slots) {
        if (a[slotId] === b[slotId]) continue;
        const e = b[slotId];
        if (!e) ops.push({ t: "log.del", date, slotId });
        else ops.push({ t: "log.set", date, slotId, status: e.status, subject: e.subject ?? null, kind: e.kind ?? null });
      }
    }
  }
  if (prev.baseline !== next.baseline) {
    const codes = new Set([...Object.keys(prev.baseline), ...Object.keys(next.baseline)]);
    for (const code of codes) {
      if (prev.baseline[code] === next.baseline[code]) continue;
      const b = next.baseline[code];
      ops.push({
        t: "baseline.set", code,
        b: b ? { tp: b.theoryPresent || 0, tt: b.theoryTotal || 0, cp: b.clinicalPresent || 0, ct: b.clinicalTotal || 0 } : null,
      });
    }
  }
  if (prev.aetcomDone !== next.aetcomDone) {
    for (const id of Object.keys(next.aetcomDone)) {
      if (prev.aetcomDone[id] !== next.aetcomDone[id]) ops.push({ t: "module.set", key: `aetcom:${id}`, done: Boolean(next.aetcomDone[id]) });
    }
  }
  if (prev.pandemicDone !== next.pandemicDone) {
    for (const id of Object.keys(next.pandemicDone)) {
      if (prev.pandemicDone[id] !== next.pandemicDone[id]) ops.push({ t: "module.set", key: `pandemic:${id}`, done: Boolean(next.pandemicDone[id]) });
    }
  }
  const patch: Partial<{ name: string; rollNo: number; theoryTarget: number; clinicalTarget: number; theme: string }> = {};
  let hasPatch = false;
  for (const f of PROFILE_FIELDS) {
    if (prev.profile[f] !== next.profile[f] && f !== "email") {
      (patch as Record<string, unknown>)[f] = next.profile[f];
      hasPatch = true;
    }
  }
  if (hasPatch) ops.push({ t: "profile.set", patch });
  return ops;
}

/* ---------- context ---------- */
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
  resetAll: () => Promise<void>;
  importState: (json: string) => boolean;
  setTheme: (theme: "light" | "dark") => void;
  /* sync */
  authed: boolean;
  syncStatus: SyncStatus;
  pending: number;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, name: string, rollNo: number, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  retrySync: () => void;
}
const Ctx = createContext<AttendMateCtx | null>(null);

export function AttendMateProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(() => createDefaultState());
  const [canUndo, setCanUndo] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastActionAt, setLastActionAt] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [pending, setPending] = useState(0);
  const undoRef = useRef<UndoSnapshot[]>([]);
  const hydrated = useRef(false);
  const stateRef = useRef<AppState>(state);
  const authedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const inFlight = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  const note = useCallback((label: string) => {
    setLastAction(label);
    setLastActionAt(Date.now());
  }, []);

  /**
   * Account isolation: local storage (state + op queue) belongs to exactly one
   * account. When the active session user differs from the stored copy's owner
   * — or the copy is un-attributable guest data — discard it before pulling the
   * server snapshot, so two students sharing a browser can never see or merge
   * each other's records.
   */
  const adoptLocalCopyFor = useCallback((user: { id: string }, migrateGuest: boolean) => {
    const local = loadStored();
    const owner = local.syncOwnerId ?? null;
    const foreign = owner !== null && owner !== user.id;
    const guest = owner === null;
    if (foreign || (guest && !migrateGuest)) {
      const fresh = createDefaultState();
      fresh.profile.theme = getStoredTheme(); // theme stays device-local
      saveStored(fresh);
      clearQueue(user.id);
    }
  }, []);

  const persist = useCallback((next: AppState) => {
    saveStored(next);
    setCanUndo(undoRef.current.length > 0);
  }, []);

  const refreshPending = useCallback(() => setPending(pendingCount(userIdRef.current)), []);

  /* ---------- flush loop ---------- */
  const flush = useCallback(async () => {
    if (!authedRef.current || inFlight.current) return;
    const ops = readPendingOps(userIdRef.current);
    if (ops.length === 0) { setSyncStatus("synced"); return; }
    inFlight.current = true;
    setSyncStatus("saving");
    const startedAt = Date.now();
    try {
      await apiPush(ops.map((e) => e.op));
      // drop the ops we just pushed, unless they were re-touched mid-flight
      const pushedKeys = new Set(ops.map((e) => e.key));
      const rest = readPendingOps(userIdRef.current).filter((e) => !pushedKeys.has(e.key) || e.at > startedAt);
      writePendingOps(rest, userIdRef.current);
      refreshPending();
      setSyncStatus(rest.length === 0 ? "synced" : "queued");
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 401) {
        authedRef.current = false;
        userIdRef.current = null;
        setAuthed(false);
        setSyncStatus("local");
      } else if (status && status < 500) {
        setSyncStatus("error"); // bad request — needs human attention, queue kept
      } else {
        setSyncStatus("offline");
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => { void flush(); }, 8000);
      }
    } finally {
      inFlight.current = false;
    }
  }, [refreshPending]);

  const scheduleFlush = useCallback(() => {
    if (!authedRef.current) return;
    setSyncStatus("queued");
    refreshPending();
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => { void flush(); }, 900);
  }, [flush, refreshPending]);

  /* ---------- boot: hydrate local, then reconcile with the server ---------- */
  useEffect(() => {
    const loaded = loadStored();
    const theme = getStoredTheme();
    applyThemeClass(theme);
    setStateRaw({ ...loaded, profile: { ...loaded.profile, theme } });
    hydrated.current = true;
    refreshPending();

    (async () => {
      const user = await apiMe();
      if (!user) { setSyncStatus("local"); return; }
      authedRef.current = true;
      userIdRef.current = user.id;
      setAuthed(true);
      adoptLocalCopyFor(user, false); // a live session never adopts foreign or guest copies
      const merge = await pullAndMerge(loadStored(), user.id);
      if (merge) {
        setStateRaw({ ...merge.state, profile: { ...merge.state.profile, theme: getStoredTheme() } });
        setSyncStatus(merge.importedOps > 0 || pendingCount(user.id) > 0 ? "queued" : "synced");
      } else {
        setSyncStatus("offline");
      }
      refreshPending();
      void flush();
    })();

    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  /* ---------- state mutation (with op diffing) ---------- */
  const setState = useCallback((updater: (prev: AppState) => AppState, undoLabel?: string) => {
    setStateRaw((prev) => {
      if (undoLabel) {
        undoRef.current.push({ label: undoLabel, state: prev });
        if (undoRef.current.length > 40) undoRef.current.shift();
      }
      const next = updater(prev);
      persist(next);
      const ops = diffOps(prev, next);
      if (authedRef.current && ops.length > 0) {
        enqueueOps(ops, userIdRef.current);
        // schedule outside the updater to avoid side effects mid-render
        setTimeout(scheduleFlush, 0);
      }
      return next;
    });
    if (undoLabel) note(undoLabel);
  }, [persist, note, scheduleFlush]);

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
    const ops = diffOps(stateRef.current, snap.state);
    if (authedRef.current && ops.length > 0) {
      enqueueOps(ops, userIdRef.current);
      setTimeout(scheduleFlush, 0);
    }
    setCanUndo(undoRef.current.length > 0);
    note("Last action undone");
  }, [persist, note, scheduleFlush]);

  const resetAll = useCallback(async () => {
    if (authedRef.current) {
      try { await apiWipeServerData(); } catch { /* best effort — local reset proceeds */ }
    }
    clearQueue(userIdRef.current);
    refreshPending();
    const fresh = createDefaultState();
    fresh.syncOwnerId = userIdRef.current; // reset copy stays bound to the active account
    setStateRaw(fresh);
    saveStored(fresh);
    undoRef.current = [];
    setCanUndo(false);
    setSyncStatus(authedRef.current ? "synced" : "local");
    note("All data erased");
  }, [note, refreshPending]);

  const importState = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== "object" || !parsed.profile) return false;
      // Imported copies never carry a foreign owner tag — they belong to the
      // active account (or stay guest data when signed out).
      setState(() => ({ ...createDefaultState(), ...parsed, syncOwnerId: userIdRef.current, profile: { ...createDefaultState().profile, ...(parsed.profile || {}) } }), "Import backup");
      return true;
    } catch { return false; }
  }, [setState]);

  const setTheme = useCallback((theme: "light" | "dark") => {
    applyThemeClass(theme);
    try { localStorage.setItem("attendmate_site_theme", theme); } catch { /* ignore */ }
    setState((prev) => ({ ...prev, profile: { ...prev.profile, theme } }));
  }, [setState]);

  /* ---------- auth flows ---------- */
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const user = await apiLogin(email, password);
      // Isolation: only reuse the local copy if it belongs to this account.
      // Foreign-account and guest copies are wiped first (guest data cannot be
      // attributed, so it never flows into an existing account) — the server
      // snapshot is the single source of truth.
      adoptLocalCopyFor(user, false);
      authedRef.current = true;
      userIdRef.current = user.id;
      setAuthed(true);
      const merge = await pullAndMerge(loadStored(), user.id);
      if (merge) {
        setStateRaw({ ...merge.state, profile: { ...merge.state.profile, email: user.email, theme: getStoredTheme() } });
      }
      setSyncStatus(pendingCount(user.id) > 0 ? "queued" : "synced");
      refreshPending();
      void flush();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message || "Sign-in failed" };
    }
  }, [flush, refreshPending, adoptLocalCopyFor]);

  const signUp = useCallback(async (email: string, name: string, rollNo: number, password: string) => {
    try {
      const user = await apiRegister(email, name, rollNo, password);
      // First-time migration: an un-attributed guest copy (this device, never
      // signed in) is imported into the new account. A copy that belongs to
      // another account is wiped — it must never flow into the new account.
      adoptLocalCopyFor(user, true);
      authedRef.current = true;
      userIdRef.current = user.id;
      setAuthed(true);
      // Server is empty, so pullAndMerge queues all local-only records and the
      // flush imports them.
      const merge = await pullAndMerge(loadStored(), user.id);
      if (merge) {
        setStateRaw({ ...merge.state, profile: { ...merge.state.profile, email: user.email, theme: getStoredTheme() } });
      }
      setSyncStatus("queued");
      refreshPending();
      void flush();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message || "Registration failed" };
    }
  }, [flush, refreshPending, adoptLocalCopyFor]);

  const signOut = useCallback(async () => {
    try { await apiLogout(); } catch { /* session may already be gone */ }
    // Drop queued ops so nothing can flush into a different account later; the
    // local copy stays on this device, locked to this account via its owner tag.
    clearQueue(null);
    userIdRef.current = null;
    authedRef.current = false;
    setAuthed(false);
    setSyncStatus("local");
    note("Signed out — data stays on this device, locked to your account");
  }, [note]);

  const retrySync = useCallback(() => { void flush(); }, [flush]);

  const value = useMemo<AttendMateCtx>(() => ({
    state, setState, markSlot, bulkMarkDay, copyPreviousDay, addExtraClass, removeSlot,
    bulkFill, undo, canUndo, lastAction, lastActionAt, resetAll, importState, setTheme,
    authed, syncStatus, pending, signIn, signUp, signOut, retrySync,
  }), [state, setState, markSlot, bulkMarkDay, copyPreviousDay, addExtraClass, removeSlot, bulkFill, undo, canUndo, lastAction, lastActionAt, resetAll, importState, setTheme, authed, syncStatus, pending, signIn, signUp, signOut, retrySync]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAttendMate(): AttendMateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAttendMate must be used inside AttendMateProvider");
  return ctx;
}
