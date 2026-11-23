import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { decryptSecret, hashBackupCode, newBackupCodes, verifyTotp } from "@/lib/server/totp";
import { twoFaEnableSchema } from "@/lib/server/validation";

/**
 * Confirms enrolment with a live code from the authenticator, activates 2FA,
 * and issues 10 one-time backup codes (hashes stored; plaintext shown once).
 */
export const POST = mutate(
  async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) return jsonError(401, "Not signed in");
    if (user.totpEnabled) return jsonError(409, "Two-factor authentication is already enabled");
    const { code } = twoFaEnableSchema.parse(await readJson(req, 4 * 1024));

    const secret = user.pendingTotpSecret ? decryptSecret(user.pendingTotpSecret) : null;
    if (!secret) return jsonError(400, "Start the setup first — no pending authenticator");

    if (!verifyTotp(secret, code)) {
      return jsonError(400, "That code didn't match — check your authenticator and try again");
    }

    const backupCodes = newBackupCodes();
    await db.user.update({
      where: { id: user.id },
      data: {
        totpSecret: user.pendingTotpSecret,
        pendingTotpSecret: null,
        totpEnabled: true,
        backupCodes: JSON.stringify(backupCodes.map(hashBackupCode)),
        totpFailedAttempts: 0,
      },
    });
    return NextResponse.json({ backupCodes });
  },
  { limit: 5, windowMs: 60_000 },
);
