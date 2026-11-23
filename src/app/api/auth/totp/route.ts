import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearPreAuth, getPreAuthUser, recordLoginEvent } from "@/lib/server/auth";
import { clearFailures, finishLogin, registerFailure } from "@/lib/server/login";
import { consumeBackupCode, decryptSecret, verifyTotp } from "@/lib/server/totp";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { totpVerifySchema } from "@/lib/server/validation";

/**
 * Step 2 of login for 2FA accounts: a 6-digit authenticator code or a one-time
 * backup code. The caller is identified by the short-lived pre-auth cookie —
 * no session exists until a valid code is presented. Failures feed the same
 * per-account lockout as wrong passwords (5 → 15 min).
 */
export const POST = mutate(
  async (req: NextRequest) => {
    const { code } = totpVerifySchema.parse(await readJson(req, 4 * 1024));
    const user = await getPreAuthUser(req);
    if (!user) return jsonError(401, "Sign-in session expired — start again");

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await recordLoginEvent(user.id, "locked", req);
      return jsonError(429, "Too many failed attempts — try again in a few minutes");
    }

    const normalized = code.replace(/\s/g, "").toUpperCase();
    let ok = false;
    let backupHashes: string[] | null = null;
    if (/^\d{6}$/.test(normalized)) {
      const secret = user.totpSecret ? decryptSecret(user.totpSecret) : null;
      ok = Boolean(secret && verifyTotp(secret, normalized));
    } else {
      backupHashes = consumeBackupCode(normalized, user.backupCodes);
      ok = backupHashes !== null;
    }

    if (!ok) {
      await registerFailure(user.id, "totpFailedAttempts");
      await recordLoginEvent(user.id, "bad_totp", req);
      return jsonError(401, "Invalid or expired code");
    }

    await clearFailures(user.id);
    if (backupHashes) {
      await db.user.update({ where: { id: user.id }, data: { backupCodes: JSON.stringify(backupHashes) } });
    }
    const res = await finishLogin(req, user.id);
    await clearPreAuth(res);
    return res;
  },
  { limit: 10, windowMs: 5 * 60_000 },
);
