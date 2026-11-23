import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, mutate } from "@/lib/server/http";
import { encryptSecret, newTotpSecret, totpQrDataUrl, totpUri } from "@/lib/server/totp";

/** Starts 2FA enrolment: generates a fresh secret (not yet active) + QR code. */
export const POST = mutate(
  async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) return jsonError(401, "Not signed in");
    if (user.totpEnabled) return jsonError(409, "Two-factor authentication is already enabled");

    const secret = newTotpSecret();
    await db.user.update({
      where: { id: user.id },
      data: { pendingTotpSecret: encryptSecret(secret) },
    });
    const uri = totpUri(user.email, secret);
    return NextResponse.json({ uri, qrDataUrl: await totpQrDataUrl(uri) });
  },
  { limit: 5, windowMs: 60_000 },
);
