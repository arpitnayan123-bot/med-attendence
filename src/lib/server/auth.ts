import "server-only";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Session auth: HS256 JWT in an httpOnly cookie, backed by a server-side
 * Session row so any session can be revoked (device list, sign-out everywhere,
 * password change). Sessions carry the user id + session id; the user row is
 * fetched per request so deleted accounts invalidate immediately.
 * - Passwords hashed with bcrypt (12 rounds).
 * - 2FA: a short-lived "pre-auth" cookie (audience=2fa) bridges login and the
 *   TOTP step; no session exists until the code is verified.
 * - CSRF: mutating endpoints require a custom header (x-am-csrf) plus a
 *   same-origin Origin check (see http.ts) — cross-site requests cannot set
 *   custom headers without a CORS preflight, which is not offered.
 */

export const SESSION_COOKIE = "am_session";
export const PREAUTH_COOKIE = "am_preauth";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30;
const PREAUTH_TTL_SEC = 60 * 5;
const BCRYPT_ROUNDS = 12;
const LASTSEEN_TOUCH_MS = 60_000; // throttle the per-request lastSeen write

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is required in production — generate with `openssl rand -hex 32`");
    }
    console.warn("[auth] AUTH_SECRET not set — using INSECURE dev secret");
    return new TextEncoder().encode("dev-only-insecure-secret-change-me");
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/* ---------- device identity (loose, WiFi-NAT friendly) ---------- */

export function deviceHashFrom(req: NextRequest): string {
  const ua = req.headers.get("user-agent") || "unknown";
  return crypto.createHash("sha256").update(ua).digest("hex").slice(0, 16);
}

export function uaFrom(req: NextRequest): string {
  return (req.headers.get("user-agent") || "unknown device").slice(0, 160);
}

export function uaLabel(ua: string): string {
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "unknown OS";
  return `${browser} · ${os}`;
}

/* ---------- login events (audit trail) ---------- */

export type LoginOutcome = "ok" | "bad_password" | "bad_totp" | "locked" | "password_changed" | "reset" | "device_revoked";

export async function recordLoginEvent(
  userId: string,
  outcome: LoginOutcome,
  req: NextRequest,
  opts?: { newDevice?: boolean },
) {
  try {
    await db.loginEvent.create({
      data: {
        userId,
        outcome,
        ip: ipFrom(req),
        ua: uaFrom(req),
        deviceHash: deviceHashFrom(req),
        newDevice: opts?.newDevice ?? false,
      },
    });
    // keep the trail bounded
    const old = await db.loginEvent.findMany({
      where: { userId },
      orderBy: { at: "desc" },
      skip: 50,
      select: { id: true },
    });
    if (old.length > 0) {
      await db.loginEvent.deleteMany({ where: { id: { in: old.map((e) => e.id) } } });
    }
  } catch (err) {
    console.error("[auth] login event failed:", err);
  }
}

export function ipFrom(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

/* ---------- session lifecycle ---------- */

export async function createSession(res: NextResponse, userId: string, req: NextRequest) {
  const session = await db.session.create({
    data: { userId, ua: uaFrom(req), deviceHash: deviceHashFrom(req), ip: ipFrom(req) },
  });
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(session.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(secretKey());
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SEC,
    path: "/",
  });
  return session.id;
}

export async function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

/** Short-lived cookie bridging password → TOTP step (no session yet). */
export async function createPreAuth(res: NextResponse, userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("2fa")
    .setIssuedAt()
    .setExpirationTime(`${PREAUTH_TTL_SEC}s`)
    .sign(secretKey());
  res.cookies.set(PREAUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PREAUTH_TTL_SEC,
    path: "/",
  });
}

export async function clearPreAuth(res: NextResponse) {
  res.cookies.set(PREAUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

async function preAuthUserIdFrom(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(PREAUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: "2fa" });
    return payload.sub || null;
  } catch {
    return null;
  }
}

/** The pre-authenticated user during the TOTP step of login, or null. */
export async function getPreAuthUser(req: NextRequest) {
  const userId = await preAuthUserIdFrom(req);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  return user && user.totpEnabled ? user : null;
}

export function sessionTokenFrom(req: NextRequest): string | undefined {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

/** Resolves the authenticated user from the session cookie + server-side session, or null. */
export async function getSessionUser(req: NextRequest) {
  const token = sessionTokenFrom(req);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const userId = payload.sub;
    const sid = payload.jti;
    if (!userId || !sid) return null;
    const session = await db.session.findUnique({ where: { id: sid } });
    if (!session || session.revokedAt || session.userId !== userId) return null;
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user) {
      const now = Date.now();
      if (now - session.lastSeenAt.getTime() > LASTSEEN_TOUCH_MS) {
        await db.session.update({ where: { id: sid }, data: { lastSeenAt: new Date() } });
      }
      if (now - user.lastSeenAt.getTime() > LASTSEEN_TOUCH_MS) {
        await db.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
      }
    }
    return user;
  } catch {
    return null;
  }
}

/** Id of the caller's live session, or null. */
export async function currentSessionId(req: NextRequest): Promise<string | null> {
  const token = sessionTokenFrom(req);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.jti || null;
  } catch {
    return null;
  }
}

export async function revokeSession(sessionId: string) {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string | null) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export function publicUser(u: {
  id: string; email: string; name: string; rollNo: number;
  theoryTarget: number; clinicalTarget: number; theme: string;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    rollNo: u.rollNo,
    theoryTarget: u.theoryTarget,
    clinicalTarget: u.clinicalTarget,
    theme: u.theme,
  };
}
