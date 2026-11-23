"use client";
// Client API layer for AttendMate Pro — credentials & security ONLY.
// There is no data sync: attendance, baselines, module progress, targets and
// theme live exclusively on each user's device (per-owner localStorage behind
// an explicit storage consent — see device-storage.ts and storage.tsx). The
// server answers sign-in / 2FA / password / device questions and nothing else.

/* ---------- wire types ---------- */
export interface ServerUser {
  id: string; email: string; name: string; rollNo: number;
}

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

/* ---------- auth calls ---------- */
export async function apiExists(email: string): Promise<boolean> {
  const r = await apiJson<{ exists: boolean }>("/api/auth/exists", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return r.exists;
}
export type LoginResult = { user: ServerUser; twoFactorRequired?: false } | { user?: undefined; twoFactorRequired: true };
export async function apiLogin(email: string, password: string): Promise<LoginResult> {
  const r = await apiJson<{ user?: ServerUser; twoFactorRequired?: boolean }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return r.twoFactorRequired ? { twoFactorRequired: true } : { user: r.user as ServerUser };
}
/** Login step 2 for 2FA accounts: authenticator code or backup code. */
export async function apiTotpVerify(code: string): Promise<ServerUser> {
  const r = await apiJson<{ user: ServerUser }>("/api/auth/totp", {
    method: "POST",
    body: JSON.stringify({ code }),
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
/**
 * Step-up verification for destructive actions on the user's own device
 * (Reset all data). No data is sent or stored server-side — it only confirms
 * the caller still knows the account credentials (+ TOTP when enabled).
 */
export async function apiVerifyPassword(stepUp: { password: string; code?: string }): Promise<void> {
  await apiJson("/api/auth/verify-password", { method: "POST", body: JSON.stringify({ stepUp }) });
}

/* ---------- security APIs (2FA, devices, history, password) ---------- */
export interface SecurityStatus {
  totpEnabled: boolean;
  emailVerified: boolean;
  mailConfigured: boolean;
  backupCodesLeft: number;
  loginEvents: { id: string; at: string; label: string; device: string; ip: string; newDevice: boolean }[];
}
export interface DeviceSession {
  id: string; label: string; ip: string; createdAt: string; lastSeenAt: string; current: boolean;
}
export async function apiSecurity(): Promise<SecurityStatus> {
  return apiJson<SecurityStatus>("/api/auth/security");
}
export async function apiSetup2fa(): Promise<{ uri: string; qrDataUrl: string }> {
  return apiJson("/api/auth/2fa/setup", { method: "POST" });
}
export async function apiEnable2fa(code: string): Promise<{ backupCodes: string[] }> {
  return apiJson("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
}
export async function apiDisable2fa(password: string, code: string): Promise<void> {
  await apiJson("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password, code }) });
}
export async function apiRegenBackupCodes(password: string): Promise<{ backupCodes: string[] }> {
  return apiJson("/api/auth/2fa/backup", { method: "POST", body: JSON.stringify({ password }) });
}
export async function apiSessions(): Promise<DeviceSession[]> {
  const r = await apiJson<{ sessions: DeviceSession[] }>("/api/auth/sessions");
  return r.sessions;
}
export async function apiRevokeSession(id: string): Promise<{ signedOut?: boolean }> {
  return apiJson("/api/auth/sessions", { method: "DELETE", body: JSON.stringify({ id }) });
}
export async function apiRevokeAllSessions(): Promise<{ signedOut: boolean }> {
  return apiJson("/api/auth/sessions", { method: "DELETE", body: JSON.stringify({ all: true }) });
}
export async function apiChangePassword(currentPassword: string, newPassword: string, code?: string): Promise<void> {
  await apiJson("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword, code }) });
}
export async function apiResetRequest(email: string): Promise<void> {
  await apiJson("/api/auth/reset-request", { method: "POST", body: JSON.stringify({ email }) });
}
