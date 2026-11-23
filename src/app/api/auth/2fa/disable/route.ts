import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, verifyPassword } from "@/lib/server/auth";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { consumeBackupCode, decryptSecret, verifyTotp } from "@/lib/server/totp";
import { twoFaDisableSchema } from "@/lib/server/validation";

/** Turns 2FA off. Requires the password + a live code or a backup code. */
export const POST = mutate(
  async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) return jsonError(401, "Not signed in");
    if (!user.totpEnabled) return jsonError(409, "Two-factor authentication is not enabled");
    const { password, code } = twoFaDisableSchema.parse(await readJson(req, 4 * 1024));

    if (!(await verifyPassword(password, user.passwordHash))) {
      return jsonError(401, "Incorrect password");
    }

    const normalized = code.replace(/\s/g, "").toUpperCase();
    let codeOk = false;
    if (/^\d{6}$/.test(normalized)) {
      const secret = user.totpSecret ? decryptSecret(user.totpSecret) : null;
      codeOk = Boolean(secret && verifyTotp(secret, normalized));
    } else {
      codeOk = consumeBackupCode(normalized, user.backupCodes) !== null;
    }
    if (!codeOk) return jsonError(401, "Invalid or expired code");

    await db.user.update({
      where: { id: user.id },
      data: { totpSecret: null, pendingTotpSecret: null, totpEnabled: false, backupCodes: null, totpFailedAttempts: 0 },
    });
    return NextResponse.json({ ok: true });
  },
  { limit: 5, windowMs: 60_000 },
);
