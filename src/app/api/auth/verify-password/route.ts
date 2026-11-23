import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, verifyPassword } from "@/lib/server/auth";
import { consumeBackupCode, decryptSecret, verifyTotp } from "@/lib/server/totp";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { stepUpSchema } from "@/lib/server/validation";
import { z } from "zod";

/**
 * Step-up verification for destructive actions performed on the user's OWN
 * device (e.g. "Reset all data"). The server never stores or touches any user
 * data — it only answers "is this still the account owner?" with the same
 * proof strength as sign-in: password, plus TOTP/backup code when 2FA is on.
 * A failed proof throws (401) and the client aborts the erase.
 */
export const POST = mutate(
  async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) return jsonError(401, "Not signed in");
    const { stepUp } = z.object({ stepUp: stepUpSchema }).parse(await readJson(req, 4 * 1024));

    if (!(await verifyPassword(stepUp.password, user.passwordHash))) {
      return jsonError(401, "Incorrect password");
    }
    if (user.totpEnabled) {
      const code = stepUp.code || "";
      const normalized = code.replace(/\s/g, "").toUpperCase();
      let ok = false;
      if (/^\d{6}$/.test(normalized)) {
        const secret = user.totpSecret ? decryptSecret(user.totpSecret) : null;
        ok = Boolean(secret && verifyTotp(secret, normalized));
      } else if (code) {
        ok = consumeBackupCode(normalized, user.backupCodes) !== null;
      }
      if (!ok) return jsonError(401, "Invalid or expired authenticator code");
    }
    return NextResponse.json({ ok: true });
  },
  { limit: 5, windowMs: 60_000 },
);
