import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSession, deviceHashFrom, ipFrom, publicUser, recordLoginEvent, uaFrom, uaLabel,
} from "@/lib/server/auth";
import { jsonError } from "@/lib/server/http";
import { sendNewDeviceAlert } from "@/lib/server/mail";

/**
 * Shared tail of every successful login (password-only or password+TOTP):
 * device recognition, session creation, audit event, first-use alert.
 */
export async function finishLogin(req: NextRequest, userId: string): Promise<NextResponse> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.emailVerified) {
    return jsonError(401, "Invalid email or password");
  }
  const res = NextResponse.json({ user: publicUser(user) });
  const deviceHash = deviceHashFrom(req);
  const seenBefore = await db.loginEvent.findFirst({ where: { userId, outcome: "ok", deviceHash } });
  const newDevice = !seenBefore;
  await createSession(res, user.id, req);
  await recordLoginEvent(user.id, "ok", req, { newDevice });
  if (newDevice) {
    void sendNewDeviceAlert(user.email, uaLabel(uaFrom(req)), ipFrom(req), new Date().toUTCString());
  }
  return res;
}

/** Per-account brute-force lockout shared by the password and TOTP steps. */
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_MS = 15 * 60_000;

export async function registerFailure(userId: string, field: "failedAttempts" | "totpFailedAttempts") {
  const user = await db.user.findUnique({ where: { id: userId }, select: { failedAttempts: true, totpFailedAttempts: true } });
  if (!user) return;
  const attempts = (field === "failedAttempts" ? user.failedAttempts : user.totpFailedAttempts) + 1;
  await db.user.update({
    where: { id: userId },
    data: {
      [field]: attempts,
      lockedUntil: attempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MS) : undefined,
    },
  });
}

export async function clearFailures(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: { failedAttempts: 0, totpFailedAttempts: 0, lockedUntil: null },
  });
}
