"use client";
// AttendMate Pro — client state + DEVICE-ONLY persistence.
// Nothing is uploaded: every user's data lives in this browser, in a
// per-owner store (`attendmate_pro_v2:<userId>`, guest = `:guest`), written
// only after the user explicitly allowed device storage (consent gate).
// The server holds just sign-in credentials + 2FA/security — see sync.ts.
// Ownership is isolated: switching accounts switches stores, so two students
// on a shared browser never see each other's records. Moving devices = the
// Export/Import backup files in Settings.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { AppState, SlotEntry, MarkStatus, MASTER_TIMETABLE } from "./data";
import { todayISO, getClinicalPostingForDate, shiftDate, daysBetween, getGroupInfo } from "./engine";
import { ServerUser, apiMe, apiLogin, apiTotpVerify, apiRegister, apiLogout, apiVerifyPassword, friendlyAuthError } from "./sync";
import {
  StorageConsent, readConsent, grantConsent as persistConsentFlag, requestPersistent as askPersistent,
  isPersistent, migrateLegacyStore, readOwnerStore, writeOwnerStore, removeOwnerStore, wipeAllDeviceData, snapshotOwnerStore,
} from "./device-storage";

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

function normalizeStored(parsed: Partial<AppState> | null): AppState {
  const base = createDefaultState();
  if (!parsed || typeof parsed !== "object") return base;
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

/* ---------- context ---------- */
export interface UndoSnapshot { label: string; state: AppState }

/* Undo lives in memory while the tab is open and is mirrored to a per-owner
   store so a reload (or an app switch the browser kept alive long enough to
   drop) restores it. Cap 40, same as the stack. Key is additive to the main
   store schema — nothing in attendmate_pro_v2:<owner> changes shape. */
function undoKey(owner: string | null): string { return `attendmate_pro_v2_undo:${owner || "guest"}`; }
function readUndoStore(owner: string | null): UndoSnapshot[] {
  try {
    const raw = localStorage.getItem(undoKey(owner));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x.label === "string" && x.state).slice(-40) : [];
  } catch { return []; }
}
function writeUndoStore(owner: string | null, stack: UndoSnapshot[]): void {
  try { localStorage.setItem(undoKey(owner), JSON.stringify(stack.slice(-40))); } catch { /* quota — undo stays in-memory */ }
}

export interface AttendMateCtx {
  state: AppState;
  setState: (updater: (prev: AppState) => AppState, undoLabel?: string) => void;
  markSlot: (iso: string, slotId: string, status: MarkStatus, subject?: string, kind?: "theory" | "clinical") => void;
  unmarkSlot: (iso: string, slotId: string) => void;
  bulkMarkDay: (iso: string, status: MarkStatus, subGroup?: string) => void;
  bulkFill: (from: string, to: string, status: MarkStatus, subGroup: string) => void;
  copyPreviousDay: (iso: string) => void;
  addExtraClass: (iso: string, subject: string, kind: "theory" | "clinical") => void;
  removeSlot: (iso: string, slotId: string) => void;
  undo: () => void;
  canUndo: boolean;
  lastAction: string | null;
  lastActionAt: number;
  resetAll: (stepUp?: { password: string; code?: string }) => Promise<void>;
  importState: (json: string) => boolean;
  setTheme: (theme: "light" | "dark") => void;
  /* account */
  authed: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string; twoFactorRequired?: boolean }>;
  verifyTotp: (code: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, name: string, rollNo: number, password: string) => Promise<{ ok: boolean; error?: string }>;
  claimDeviceProfile: (name: string, email: string, rollNo: number) => void;
  signOut: () => Promise<void>;
  /* device storage consent */
  storageState: StorageConsent;
  persistent: boolean;
  grantStorage: () => Promise<void>;
  denyStorage: () => void;
  requestPersistent: () => Promise<void>;
  forgetDevice: () => void;
}
const Ctx = createContext<AttendMateCtx | null>(null);

export function AttendMateProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(() => createDefaultState());
  const [canUndo, setCanUndo] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastActionAt, setLastActionAt] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [storageState, setStorageState] = useState<StorageConsent>("unknown");
  const [persistent, setPersistent] = useState(false);
  const undoRef = useRef<UndoSnapshot[]>([]);
  const stateRef = useRef<AppState>(state);
  const authedRef = useRef(false);
  const ownerRef = useRef<string | null>(null); // active store owner: userId | null = guest
  const consentRef = useRef<StorageConsent>("unknown");
  useEffect(() => { stateRef.current = state; }, [state]);

  const note = useCallback((label: string) => {
    setLastAction(label);
    setLastActionAt(Date.now());
  }, []);

  /* snapshot throttle: at most one rolling snapshot per minute / per day /
     owner — owner switches always snapshot (that is when copies get replaced) */
  const lastSnapDayRef = useRef("");
  const lastSnapAtRef = useRef(0);
  const lastSnapOwnerRef = useRef<string | null>(null);

  /** Consent-gated write: the ONLY path any data ever reaches storage. */
  const persist = useCallback((next: AppState) => {
    if (consentRef.current === "granted") {
      writeOwnerStore(ownerRef.current, next);
      writeUndoStore(ownerRef.current, undoRef.current);
      const day = todayISO();
      const now = Date.now();
      const hasData = Object.keys(next.logs).length + Object.keys(next.baseline).length
        + Object.keys(next.aetcomDone).length + Object.keys(next.pandemicDone).length > 0;
      const ownerChanged = ownerRef.current !== lastSnapOwnerRef.current;
      if (hasData && (ownerChanged || day !== lastSnapDayRef.current || now - lastSnapAtRef.current > 60_000)) {
        lastSnapDayRef.current = day;
        lastSnapAtRef.current = now;
        lastSnapOwnerRef.current = ownerRef.current;
        snapshotOwnerStore(ownerRef.current, next, day); // rolling safety net
      }
    }
    setCanUndo(undoRef.current.length > 0);
  }, []);

  /** Builds the active state for an owner store (identity overlaid from the server, theme stays device-local). */
  const applyOwnerState = useCallback((owner: string | null, user: ServerUser | null, carryGuestData: boolean) => {
    const existing = readOwnerStore<Partial<AppState>>(owner);
    const theme = getStoredTheme();
    let next: AppState;
    const hasGuestData = Boolean(existing) || (() => {
      const s = stateRef.current;
      return Object.keys(s.logs).length + Object.keys(s.baseline).length + Object.keys(s.aetcomDone).length + Object.keys(s.pandemicDone).length > 0;
    })();
    if (existing) {
      next = normalizeStored(existing);
      if (user) next.profile = { ...next.profile, email: user.email, name: user.name, rollNo: user.rollNo };
    } else if (carryGuestData && user && hasGuestData) {
      // First sign-up on a device that already has guest data: carry it into the new account's store.
      next = { ...stateRef.current, profile: { ...stateRef.current.profile, email: user.email, name: user.name, rollNo: user.rollNo, theme } };
    } else {
      next = createDefaultState();
      next.profile.theme = theme;
      if (user) next.profile = { ...next.profile, email: user.email, name: user.name, rollNo: user.rollNo };
    }
    next.syncOwnerId = owner; // store is locked to its owner
    ownerRef.current = owner;
    setStateRaw(next);
    undoRef.current = readUndoStore(owner); // reload wipes in-memory undo — restore it
    setCanUndo(undoRef.current.length > 0);
    persist(next);
  }, [persist]);

  /** Saves the active store under its current owner, then re-points the owner. */
  const switchOwner = useCallback((owner: string | null, user: ServerUser | null, carryGuestData = false) => {
    if (consentRef.current === "granted") writeOwnerStore(ownerRef.current, stateRef.current);
    applyOwnerState(owner, user, carryGuestData);
  }, [applyOwnerState]);

  /* ---------- boot: consent first, then hydrate the owner's device store ---------- */
  useEffect(() => {
    const consent = readConsent();
    consentRef.current = consent;
    const theme = getStoredTheme();
    applyThemeClass(theme);

    (async () => {
      setStorageState(consent);
      const user = await apiMe(); // credentials-only session restore — fetches no data
      if (consent === "granted") {
        migrateLegacyStore(); // pre-multi-owner single store → per-owner stores
        void isPersistent().then(setPersistent);
        if (user) {
          authedRef.current = true;
          setAuthed(true);
          applyOwnerState(user.id, user, false);
        } else {
          applyOwnerState(null, null, false);
        }
      } else {
        // Nothing is read or written before an explicit allow; remember who the
        // cookie belongs to so granting later loads the right store.
        ownerRef.current = user?.id ?? null;
        if (user) {
          authedRef.current = true;
          setAuthed(true);
        }
      }
    })();
  }, []);

  /* ---------- state mutation ---------- */
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

  const unmarkSlot = useCallback((iso: string, slotId: string) => {
    setState((prev) => {
      const dayLog = { ...(prev.logs[iso] || {}) };
      if (!(slotId in dayLog)) return prev;
      delete dayLog[slotId];
      return { ...prev, logs: { ...prev.logs, [iso]: dayLog } };
    }, `Unmark ${slotId}`);
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

  const bulkFill = useCallback((from: string, to: string, status: MarkStatus, subGroup: string) => {
    // Guard an inverted range; clamp a runaway range to 92 days (~a quarter).
    if (!from || !to || from > to) { note("Nothing to fill — check the date range"); return; }
    let end = to;
    if (daysBetween(from, end) > 91) end = shiftDate(from, 91);
    let n = 0;
    setState((prev) => {
      const logs = { ...prev.logs };
      let d = from;
      while (d <= end) {
        const dow = new Date(d + "T12:00:00").getDay();
        if (dow !== 0 && !logs[d]) {
          // CP credit resolves from the roster PER DATE — never copied across dates.
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
          n++;
        }
        d = shiftDate(d, 1);
      }
      return { ...prev, logs };
    }, "Bulk fill");
    note(n > 0 ? `Bulk-filled ${n} day${n === 1 ? "" : "s"}` : "Nothing to fill — those days are already logged or are Sundays");
  }, [setState, note]);

  const copyPreviousDay = useCallback((iso: string) => {
    setState((prev) => {
      const prevIso = shift(iso, -1);
      const src = prev.logs[prevIso];
      if (!src) return prev;
      const dow = new Date(iso + "T12:00:00").getDay();
      const valid = new Set(dow !== 0 ? MASTER_SLOTS(dow).map((s) => s.id) : []);
      // The CP credit re-resolves from the roster for the TARGET date: carrying
      // yesterday's department across a rotation boundary would credit the
      // wrong one. Manual per-day theory credits copy verbatim.
      const posting = resolvePostingCached(iso, getGroupInfo(prev.profile.rollNo).subGroup);
      const dayLog: Record<string, SlotEntry> = {};
      for (const id of Object.keys(src)) {
        if (!valid.has(id)) continue;
        const e = { ...src[id] };
        if (id.endsWith("-cp")) e.subject = posting || "CP";
        dayLog[id] = e;
      }
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

  const undo = useCallback(() => {
    const snap = undoRef.current.pop();
    if (!snap) return;
    setStateRaw(snap.state);
    persist(snap.state);
    setCanUndo(undoRef.current.length > 0);
    note("Last action undone");
  }, [persist, note]);

  const resetAll = useCallback(async (stepUp?: { password: string; code?: string }) => {
    if (authedRef.current) {
      // Destructive, so identity is re-proven server-side (password + TOTP when
      // enabled). The server stores nothing — it only says yes/no; a failed
      // proof throws and nothing is erased.
      if (!stepUp) throw new Error("Confirm with your password to erase your data");
      await apiVerifyPassword(stepUp);
    }
    removeOwnerStore(ownerRef.current);
    const fresh = createDefaultState();
    fresh.profile.theme = getStoredTheme();
    fresh.syncOwnerId = ownerRef.current; // the fresh copy stays bound to the active owner
    setStateRaw(fresh);
    persist(fresh);
    undoRef.current = [];
    writeUndoStore(ownerRef.current, []);
    setCanUndo(false);
    note("All data erased from this device");
  }, [note, persist]);

  const importState = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== "object" || !parsed.profile) return false;
      // Imported copies belong to the active owner (account or guest) on this device.
      setState(() => ({ ...normalizeStored(parsed), syncOwnerId: ownerRef.current }), "Import backup");
      return true;
    } catch { return false; }
  }, [setState]);

  const setTheme = useCallback((theme: "light" | "dark") => {
    applyThemeClass(theme);
    if (consentRef.current === "granted") {
      try { localStorage.setItem("attendmate_site_theme", theme); } catch { /* ignore */ }
    }
    setState((prev) => ({ ...prev, profile: { ...prev.profile, theme } }));
  }, [setState]);

  /* ---------- auth flows (credentials only — no data ever moves) ---------- */
  const enterAccount = useCallback((user: ServerUser, carryGuestData = false) => {
    switchOwner(user.id, user, carryGuestData);
    authedRef.current = true;
    setAuthed(true);
  }, [switchOwner]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const r = await apiLogin(email, password);
      if (r.twoFactorRequired || !r.user) {
        // Password verified, but this account has 2FA — the UI shows the code
        // step and calls verifyTotp() next. No session exists yet.
        return { ok: false, twoFactorRequired: true as const };
      }
      enterAccount(r.user);
      note("Signed in — data stays on this device");
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: friendlyAuthError(err, "Invalid email or password") };
    }
  }, [enterAccount, note]);

  const verifyTotp = useCallback(async (code: string) => {
    try {
      const user = await apiTotpVerify(code);
      enterAccount(user);
      note("Signed in — data stays on this device");
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: friendlyAuthError(err, "Invalid or expired code") };
    }
  }, [enterAccount, note]);

  const signUp = useCallback(async (email: string, name: string, rollNo: number, password: string) => {
    try {
      const user = await apiRegister(email, name, rollNo, password);
      // First registration on a device: guest data on this device is carried
      // into the new account's store (still device-local — nothing uploads).
      enterAccount(user, true);
      note("Account created — data stays on this device");
      return { ok: true as const };
    } catch (err) {
      return { ok: false, error: friendlyAuthError(err, "Registration failed") };
    }
  }, [enterAccount, note]);

  /** Device-only profile ("Continue on this device"): the primary identity of
   *  this device's guest store. If an account copy is currently active it is
   *  parked under its own owner key first — recoverable by signing back in —
   *  never wiped inline. Guest data on the device is kept and claimed. */
  const claimDeviceProfile = useCallback((name: string, email: string, rollNo: number) => {
    if (stateRef.current.syncOwnerId) switchOwner(null, null, false); // park owned copy, activate guest store
    setState((prev) => ({ ...prev, profile: { ...prev.profile, name, email, rollNo } }), "Continue on this device");
  }, [switchOwner, setState]);

  const signOut = useCallback(async () => {
    try { await apiLogout(); } catch { /* session may already be gone */ }
    // The account's device store stays on this device (its data never left it);
    // the guest store becomes active. The dashboard locks until sign-in because
    // the fresh/default guest copy has no profile — ownership stays intact.
    switchOwner(null, null, false);
    authedRef.current = false;
    setAuthed(false);
    note("Signed out — your data stays on this device");
  }, [switchOwner, note]);

  /* ---------- device-storage consent ---------- */
  const grantStorage = useCallback(async () => {
    persistConsentFlag();
    consentRef.current = "granted";
    setStorageState("granted");
    void askPersistent().then(setPersistent);
    migrateLegacyStore();
    // Load whichever owner the session (or guest) points at — before this
    // moment nothing was read or written.
    const user = authedRef.current ? await apiMe() : null;
    if (user) applyOwnerState(user.id, user, false);
    else if (!authedRef.current) applyOwnerState(null, null, false);
  }, [applyOwnerState]);

  const denyStorage = useCallback(() => {
    // No write happens here (removal only applies if saving had been granted before).
    try { localStorage.removeItem("attendmate_storage_consent"); } catch { /* ignore */ }
    consentRef.current = "denied";
    setStorageState("denied");
  }, []);

  const requestPersistent = useCallback(async () => {
    const ok = await askPersistent();
    setPersistent(ok);
    note(ok ? "Storage marked persistent" : "Browser declined persistent storage");
  }, [note]);

  const forgetDevice = useCallback(() => {
    const n = wipeAllDeviceData();
    const fresh = createDefaultState();
    fresh.profile.theme = getStoredTheme();
    fresh.syncOwnerId = ownerRef.current;
    setStateRaw(fresh);
    persist(fresh);
    undoRef.current = [];
    writeUndoStore(ownerRef.current, []);
    setCanUndo(false);
    note(n > 0 ? `Erased ${n} stored data file${n === 1 ? "" : "s"} from this device` : "Nothing stored on this device");
  }, [note, persist]);

  const value = useMemo<AttendMateCtx>(() => ({
    state, setState, markSlot, unmarkSlot, bulkMarkDay, bulkFill, copyPreviousDay, addExtraClass, removeSlot, claimDeviceProfile,
    undo, canUndo, lastAction, lastActionAt, resetAll, importState, setTheme,
    authed, signIn, verifyTotp, signUp, signOut,
    storageState, persistent, grantStorage, denyStorage, requestPersistent, forgetDevice,
  }), [state, setState, markSlot, unmarkSlot, bulkMarkDay, bulkFill, copyPreviousDay, addExtraClass, removeSlot, claimDeviceProfile, undo, canUndo, lastAction, lastActionAt, resetAll, importState, setTheme, authed, signIn, verifyTotp, signUp, signOut, storageState, persistent, grantStorage, denyStorage, requestPersistent, forgetDevice]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAttendMate(): AttendMateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAttendMate must be used inside AttendMateProvider");
  return ctx;
}
