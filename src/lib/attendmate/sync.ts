"use client";
// Client sync engine for AttendMate Pro.
// Offline-first: localStorage remains the working copy; every mutation is
// recorded as a keyed op (later ops replace earlier ones for the same key),
// flushed (debounced) to POST /api/sync when signed in, and merged back
// server-first with queue-wins on conflict (per-key last-write-wins).

import { AppState, STORAGE_KEY } from "./data";

/* ---------- wire types ---------- */
export type ServerOp =
  | { t: "log.set"; date: string; slotId: string; status: "present" | "absent" | "cancelled"; subject?: string | null; kind?: "theory" | "clinical" | null }
  | { t: "log.del"; date: string; slotId: string }
  | { t: "baseline.set"; code: string; b: { tp: number; tt: number; cp: number; ct: number } | null }
  | { t: "module.set"; key: string; done: boolean }
  | { t: "profile.set"; patch: Partial<{ name: string; rollNo: number; theoryTarget: number; clinicalTarget: number; theme: string }> };

interface QueuedOp {
  key: string;
  at: number; // epoch ms the op was created; 0 = migration import
  op: ServerOp;
}

export interface ServerUser {
  id: string; email: string; name: string; rollNo: number;
  theoryTarget: number; clinicalTarget: number; theme: string;
}

interface PullSnapshot {
  serverTime: string;
  profile: { email: string; name: string; rollNo: number; theoryTarget: number; clinicalTarget: number; theme: string; updatedAt: string };
  logs: { date: string; slotId: string; status: string; subject: string | null; kind: string | null; updatedAt: string }[];
  baselines: { code: string; theoryPresent: number; theoryTotal: number; clinicalPresent: number; clinicalTotal: number; updatedAt: string }[];
  modules: { key: string; updatedAt: string }[];
}

const QUEUE_KEY = "attendmate_sync_queue";

/**
 * The offline queue is account-bound: it persists { owner, ops } where owner
 * is the signed-in user's id (null = guest). Queued ops for one account can
 * never flush into a different account on a shared browser — every reader
 * drops queues whose owner does not match the active session.
 */
interface QueueFile { owner: string | null; ops: QueuedOp[] }

function readQueueFile(): QueueFile {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return { owner: null, ops: [] };
    const parsed = JSON.parse(raw) as QueueFile | QueuedOp[] | null;
    if (Array.isArray(parsed)) return { owner: null, ops: parsed }; // pre-owner format → treated as guest data
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.ops)) {
      return { owner: typeof parsed.owner === "string" ? parsed.owner : null, ops: parsed.ops };
    }
  } catch { /* corrupted queue — start clean */ }
  return { owner: null, ops: [] };
}
function writeQueueFile(file: QueueFile) {
  try {
    if (file.ops.length === 0 && file.owner === null) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify({ owner: file.owner, ops: file.ops.slice(-1000) }));
  } catch { /* storage unavailable */ }
}

export type SyncStatus = "local" | "synced" | "saving" | "queued" | "offline" | "error";

/* ---------- low-level fetch ---------- */
async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      // CSRF: custom header cross-site requests cannot set without a preflight
      "x-am-csrf": "1",
      ...(init?.headers || {}),
    },
    credentials: "same-origin",
  });
  return res;
}
async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch { /* keep default */ }
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

/* ---------- queue persistence ---------- */
/** Add ops, coalescing by key (last op per key wins; slot kept in place). */
export function enqueueOps(ops: ServerOp[], owner: string | null): number {
  if (ops.length === 0) return 0;
  const file = readQueueFile();
  const list = file.owner === owner ? file.ops : [];
  for (const op of ops) {
    const key = opKey(op);
    const idx = list.findIndex((e) => e.key === key);
    const entry: QueuedOp = { key, at: Date.now(), op };
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
  }
  writeQueueFile({ owner, ops: list });
  return list.length;
}
export function readPendingOps(owner: string | null): QueuedOp[] {
  const file = readQueueFile();
  return file.owner === owner ? file.ops : [];
}
export function writePendingOps(q: QueuedOp[], owner: string | null) {
  writeQueueFile({ owner, ops: q });
}
export function pendingCount(owner: string | null): number {
  const file = readQueueFile();
  return file.owner === owner ? file.ops.length : 0;
}
export function clearQueue(owner: string | null) {
  writeQueueFile({ owner, ops: [] });
}

function opKey(op: ServerOp): string {
  switch (op.t) {
    case "log.set":
    case "log.del":
      return `log:${op.date}|${op.slotId}`;
    case "baseline.set":
      return `bl:${op.code}`;
    case "module.set":
      return `mod:${op.key}`;
    case "profile.set":
      return "profile";
  }
}

/* ---------- auth calls ---------- */
export async function apiExists(email: string): Promise<boolean> {
  const r = await apiJson<{ exists: boolean }>("/api/auth/exists", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return r.exists;
}
export async function apiLogin(email: string, password: string): Promise<ServerUser> {
  const r = await apiJson<{ user: ServerUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return r.user;
}
export async function apiRegister(email: string, name: string, rollNo: number, password: string): Promise<ServerUser> {
  const r = await apiJson<{ user: ServerUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, name, rollNo, password }),
  });
  return r.user;
}
export async function apiLogout(): Promise<void> {
  await apiJson("/api/auth/logout", { method: "POST" });
}
export async function apiMe(): Promise<ServerUser | null> {
  try {
    const r = await apiJson<{ user: ServerUser }>("/api/auth/me");
    return r.user;
  } catch {
    return null;
  }
}
/* ---------- sync calls ---------- */
export async function apiPush(ops: ServerOp[]): Promise<{ applied: number; serverTime: string }> {
  return apiJson<{ applied: number; serverTime: string }>("/api/sync", {
    method: "POST",
    body: JSON.stringify({ ops }),
  });
}
export async function apiWipeServerData(): Promise<void> {
  await apiJson("/api/sync", { method: "DELETE" });
}

/* ---------- pull + merge ---------- */
export interface MergeResult {
  state: AppState;
  importedOps: number; // local-only records queued for push (migration)
  serverWins: number; // records where the server overruled local state
}

function moduleKeyFrom(appKey: string): string {
  // local maps aetcomDone["4.1"], pandemicDone["P4.1"] → server "aetcom:4.1"
  return appKey.startsWith("P") ? `pandemic:${appKey}` : `aetcom:${appKey}`;
}

function cloneState(s: AppState): AppState {
  return JSON.parse(JSON.stringify(s)) as AppState;
}

/**
 * Fetches the server snapshot and merges it into `local`.
 * Rules: profile — server wins (theme stays device-local); records — a queued
 * local op newer than the server row wins, otherwise the server wins;
 * local-only records are queued for push (first-time migration).
 * `owner` is the signed-in user's id: the merged copy is stamped with it and
 * only ops queued by the same account are honoured, so two students sharing a
 * browser can never import or flush each other's records.
 * Returns null when the fetch fails (offline / not signed in).
 */
export async function pullAndMerge(local: AppState, owner: string | null): Promise<MergeResult | null> {
  let snap: PullSnapshot;
  try {
    snap = await apiJson<PullSnapshot>("/api/sync");
  } catch {
    return null;
  }

  let serverWins = 0;
  let importedOps = 0;
  const qFile = readQueueFile();
  const queue = qFile.owner === owner ? [...qFile.ops] : [];
  const queueTime = (key: string) => Math.max(0, ...queue.filter((e) => e.key === key).map((e) => e.at));

  const merged = cloneState(local);
  merged.profile = {
    ...merged.profile,
    email: snap.profile.email,
    name: snap.profile.name || merged.profile.name,
    rollNo: snap.profile.rollNo,
    theoryTarget: snap.profile.theoryTarget,
    clinicalTarget: snap.profile.clinicalTarget,
  };

  /* logs — server rows apply unless a newer queued op exists */
  const serverLogKeys = new Set<string>();
  for (const r of snap.logs) {
    const key = `log:${r.date}|${r.slotId}`;
    serverLogKeys.add(key);
    if (queueTime(key) > Date.parse(r.updatedAt)) continue;
    serverWins++;
    const dayLog = { ...(merged.logs[r.date] || {}) };
    dayLog[r.slotId] = {
      status: r.status as "present" | "absent" | "cancelled",
      ...(r.subject ? { subject: r.subject } : {}),
      ...(r.kind ? { kind: r.kind as "theory" | "clinical" } : {}),
      ...(r.slotId.startsWith("x-") ? { custom: true } : {}),
    };
    merged.logs[r.date] = dayLog;
  }
  // local-only log entries (pre-backend data) → queue for import
  for (const [date, dayLog] of Object.entries(local.logs)) {
    for (const [slotId, entry] of Object.entries(dayLog)) {
      if (!entry || !entry.status) continue;
      const key = `log:${date}|${slotId}`;
      if (!serverLogKeys.has(key) && queueTime(key) === 0) {
        queue.push({ key, at: 0, op: { t: "log.set", date, slotId, status: entry.status, subject: entry.subject ?? null, kind: entry.kind ?? null } });
        importedOps++;
      }
    }
  }

  /* baselines */
  const serverBl = new Set<string>();
  for (const b of snap.baselines) {
    const key = `bl:${b.code}`;
    serverBl.add(key);
    if (queueTime(key) > Date.parse(b.updatedAt)) continue;
    serverWins++;
    merged.baseline[b.code] = {
      theoryPresent: b.theoryPresent, theoryTotal: b.theoryTotal,
      clinicalPresent: b.clinicalPresent, clinicalTotal: b.clinicalTotal,
    };
  }
  for (const [code, b] of Object.entries(local.baseline)) {
    if (!b || !(b.theoryTotal || b.clinicalTotal)) continue;
    const key = `bl:${code}`;
    if (!serverBl.has(key) && queueTime(key) === 0) {
      queue.push({ key, at: 0, op: { t: "baseline.set", code, b: { tp: b.theoryPresent || 0, tt: b.theoryTotal || 0, cp: b.clinicalPresent || 0, ct: b.clinicalTotal || 0 } } });
      importedOps++;
    }
  }

  /* modules */
  const serverMod = new Set<string>();
  for (const m of snap.modules) {
    const key = `mod:${m.key}`;
    serverMod.add(m.key);
    if (queueTime(key) > Date.parse(m.updatedAt)) continue;
    serverWins++;
    const appKey = m.key.slice(m.key.indexOf(":") + 1);
    if (m.key.startsWith("pandemic:")) merged.pandemicDone[appKey] = true;
    else merged.aetcomDone[appKey] = true;
  }
  const pushModule = (appKey: string) => {
    const serverKey = moduleKeyFrom(appKey);
    const key = `mod:${serverKey}`;
    const done = serverKey.startsWith("pandemic:") ? Boolean(local.pandemicDone[appKey]) : Boolean(local.aetcomDone[appKey]);
    if (done && !serverMod.has(serverKey) && queueTime(key) === 0) {
      queue.push({ key, at: 0, op: { t: "module.set", key: serverKey, done: true } });
      importedOps++;
    }
  };
  Object.keys(local.aetcomDone).forEach(pushModule);
  Object.keys(local.pandemicDone).forEach(pushModule);

  /* drop queued ops the server already overruled */
  const serverTimeFor = (op: ServerOp): number => {
    switch (op.t) {
      case "log.set":
      case "log.del": {
        const date = op.date, slotId = op.slotId;
        const row = snap.logs.find((r) => r.date === date && r.slotId === slotId);
        return row ? Date.parse(row.updatedAt) : 0;
      }
      case "baseline.set": {
        const code = op.code;
        const row = snap.baselines.find((r) => r.code === code);
        return row ? Date.parse(row.updatedAt) : 0;
      }
      case "module.set": {
        const key = op.key;
        const row = snap.modules.find((r) => r.key === key);
        return row ? Date.parse(row.updatedAt) : 0;
      }
      case "profile.set":
        return 0;
    }
  };
  const kept = queue.filter((e) => {
    if (e.at === 0) return true; // migration imports
    return e.at > serverTimeFor(e.op);
  });
  writeQueueFile({ owner, ops: kept });

  merged.syncOwnerId = owner; // this device copy now belongs to the signed-in account
  saveState(merged);
  return { state: merged, importedOps, serverWins };
}

function saveState(state: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
