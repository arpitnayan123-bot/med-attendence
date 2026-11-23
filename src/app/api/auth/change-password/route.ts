import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  currentSessionId, getSessionUser, hashPassword, recordLoginEvent, revokeAllSessions, verifyPassword,
} from "@/lib/server/auth";
import { clearFailures } from "@/lib/server/login";
import { consumeBackupCode, decryptSecret, verifyTotp } from "@/lib/server/totp";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { changePasswordSchema } from "@/lib/server/validation";

/**
 * Changes the password (step-up: current password + TOTP when enabled) and
 * revokes every other session, so a stolen old password or a borrowed device
 * stops working immediately.
 */
export const POST = mutate(
  async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) return jsonError(401, "Not signed in");
    const { currentPassword, newPassword, code } = changePasswordSchema.parse(await readJson(req, 4 * 1024));

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return jsonError(401, "Your current password is incorrect");
    }
    if (user.totpEnabled) {
      if (!code) return jsonError(400, "Enter your authenticator code");
      const normalized = code.replace(/\s/g, "").toUpperCase();
      let ok = false;
      if (/^\d{6}$/.test(normalized)) {
        const secret = user.totpSecret ? decryptSecret(user.totpSecret) : null;
        ok = Boolean(secret && verifyTotp(secret, normalized));
      } else {
        ok = consumeBackupCode(normalized, user.backupCodes) !== null;
      }
      if (!ok) return jsonError(401, "Invalid or expired code");
    }
    if (await verifyPassword(newPassword, user.passwordHash)) {
      return jsonError(400, "Choose a password you haven't used here before");
    }

    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    await clearFailures(user.id);
    const sid = await currentSessionId(req);
    await revokeAllSessions(user.id, sid);
    await recordLoginEvent(user.id, "password_changed", req);
    return NextResponse.json({ ok: true });
  },
  { limit: 5, windowMs: 60_000 },
);
