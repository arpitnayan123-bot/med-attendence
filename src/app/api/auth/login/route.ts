import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  clearPreAuth, createPreAuth, recordLoginEvent, verifyPassword,
} from "@/lib/server/auth";
import { finishLogin, clearFailures, registerFailure } from "@/lib/server/login";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { loginSchema } from "@/lib/server/validation";

/**
 * Step 1 of login: email + password.
 * - Per-account lockout: 5 wrong passwords → 15 min (also covers the TOTP step).
 * - 2FA accounts get a 5-minute pre-auth cookie and no session until the code.
 * - Responses stay generic so the endpoint never reveals which emails exist.
 */
export const POST = mutate(
  async (req: NextRequest) => {
    const body = loginSchema.parse(await readJson(req, 16 * 1024));
    const user = await db.user.findUnique({ where: { email: body.email } });

    if (user && user.lockedUntil && user.lockedUntil > new Date()) {
      await recordLoginEvent(user.id, "locked", req);
      return jsonError(429, "Too many failed attempts — try again in a few minutes");
    }

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      if (user) {
        await registerFailure(user.id, "failedAttempts");
        await recordLoginEvent(user.id, "bad_password", req);
      }
      return jsonError(401, "Invalid email or password");
    }

    // password OK — reset the failure counters
    await clearFailures(user.id);

    if (user.totpEnabled) {
      const res = NextResponse.json({ twoFactorRequired: true });
      await createPreAuth(res, user.id);
      return res;
    }

    if (!user.emailVerified) {
      return jsonError(403, "Verify your email first — check your inbox for the confirmation link");
    }

    const res = await finishLogin(req, user.id);
    await clearPreAuth(res);
    return res;
  },
  { limit: 10, windowMs: 5 * 60_000 }, // 10 logins / 5 min / IP
);
