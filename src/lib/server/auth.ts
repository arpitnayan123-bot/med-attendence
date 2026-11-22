import "server-only";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Session auth: HS256 JWT in an httpOnly cookie (30 days).
 * - Passwords hashed with bcrypt (12 rounds).
 * - Sessions carry only the user id; the user row is fetched per request so
 *   deleted accounts invalidate immediately.
 * - CSRF: mutating endpoints require a custom header (x-am-csrf) plus a
 *   same-origin Origin check (see http.ts) — cross-site requests cannot set
 *   custom headers without a CORS preflight, which is not offered.
 */

export const SESSION_COOKIE = "am_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30;
const BCRYPT_ROUNDS = 12;

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

export async function createSession(res: NextResponse, userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
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

export function sessionTokenFrom(req: NextRequest): string | undefined {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

/** Resolves the authenticated user from the session cookie, or null. */
export async function getSessionUser(req: NextRequest) {
  const token = sessionTokenFrom(req);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const userId = payload.sub;
    if (!userId) return null;
    const user = await db.user.findUnique({ where: { id: userId } });
    return user;
  } catch {
    return null;
  }
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
