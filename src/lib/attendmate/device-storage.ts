"use client";
// Device-storage consent + persistence helpers.
// The user's data lives ONLY in this browser. Before anything is written we
// ask for explicit permission; declining means zero writes — memory-only mode
// (and since nothing may be saved, the decline itself is remembered only for
// the current session). navigator.storage.persist() is requested on top, so
// the browser treats the data as persistent instead of best-effort evictable.

export type StorageConsent = "unknown" | "granted" | "denied";

/** The ONLY meta key AttendMate writes itself, and only after an explicit allow. */
export const CONSENT_KEY = "attendmate_storage_consent";
/** Pre-consolidation single-store key from the old build. */
export const LEGACY_STORE_KEY = "attendmate_pro_v2";
/** Old offline op-queue from the sync era — dead weight, removed on boot. */
export const LEGACY_QUEUE_KEY = "attendmate_sync_queue";
/** Per-owner data stores: one isolated namespace per account (or guest). */
export const OWNER_PREFIX = "attendmate_pro_v2:";

export function ownerStoreKey(owner: string | null): string {
  return OWNER_PREFIX + (owner || "guest");
}

export function readConsent(): StorageConsent {
  if (typeof window === "undefined") return "unknown";
  try {
    return localStorage.getItem(CONSENT_KEY) === "granted" ? "granted" : "unknown";
  } catch {
    return "unknown";
  }
}

/** Records an explicit allow. Never called for "denied" — denial writes nothing. */
export function grantConsent(): void {
  try { localStorage.setItem(CONSENT_KEY, "granted"); } catch { /* ignore */ }
}

/** Ask the browser to make the data persistent (not subject to auto-eviction). */
export async function requestPersistent(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch { /* unsupported */ }
  return false;
}

export async function isPersistent(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persisted) {
      return await navigator.storage.persisted();
    }
  } catch { /* unsupported */ }
  return false;
}

export interface StorageUsage { usage: number; quota: number }
export async function storageUsage(): Promise<StorageUsage | null> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch { /* unsupported */ }
  return null;
}

/** Every localStorage key AttendMate owns (data stores + consent + theme). */
export function attendmateKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(OWNER_PREFIX) || k === LEGACY_STORE_KEY || k === LEGACY_QUEUE_KEY || k === CONSENT_KEY || k === "attendmate_site_theme")) {
        keys.push(k);
      }
    }
  } catch { /* ignore */ }
  return keys;
}

/** Erases every AttendMate data store on this device (all owners + guest). Keeps the consent + theme. */
export function wipeAllDeviceData(): number {
  let n = 0;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(OWNER_PREFIX) || k === LEGACY_STORE_KEY || k === LEGACY_QUEUE_KEY)) {
        localStorage.removeItem(k);
        n++;
      }
    }
  } catch { /* ignore */ }
  return n;
}

/**
 * One-time migration from the pre-multi-owner build: the single
 * `attendmate_pro_v2` blob moves into the store of its tagged owner (or
 * guest), and the dead sync-era op queue is dropped. Idempotent.
 */
export function migrateLegacyStore(): void {
  try {
    const raw = localStorage.getItem(LEGACY_STORE_KEY);
    if (raw) {
      let owner: string | null = null;
      try {
        const parsed = JSON.parse(raw) as { syncOwnerId?: string | null };
        if (typeof parsed?.syncOwnerId === "string") owner = parsed.syncOwnerId;
      } catch { /* corrupt legacy blob — still moved under guest */ }
      const target = ownerStoreKey(owner);
      if (!localStorage.getItem(target)) localStorage.setItem(target, raw);
      localStorage.removeItem(LEGACY_STORE_KEY);
    }
    localStorage.removeItem(LEGACY_QUEUE_KEY);
  } catch { /* ignore */ }
}

/** Per-owner store read/write — callers MUST have checked consent first. */
export function readOwnerStore<T>(owner: string | null): T | null {
  try {
    const raw = localStorage.getItem(ownerStoreKey(owner));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeOwnerStore(owner: string | null, value: unknown): void {
  try {
    localStorage.setItem(ownerStoreKey(owner), JSON.stringify(value));
  } catch { /* storage full / unavailable */ }
}

export function removeOwnerStore(owner: string | null): void {
  try { localStorage.removeItem(ownerStoreKey(owner)); } catch { /* ignore */ }
}
