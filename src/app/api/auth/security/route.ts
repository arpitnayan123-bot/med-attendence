import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, uaLabel } from "@/lib/server/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/server/http";
import { mailConfigured } from "@/lib/server/mail";

const OUTCOME_LABEL: Record<string, string> = {
  ok: "Signed in",
  bad_password: "Wrong password",
  bad_totp: "Wrong 2FA code",
  locked: "Locked out",
  password_changed: "Password changed",
  reset: "Password reset",
  device_revoked: "Device signed out",
};

/** One call for the Settings → Security section. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, "Not signed in");
  let backupCodesLeft = 0;
  if (user.backupCodes) {
    try {
      const arr = JSON.parse(user.backupCodes);
      if (Array.isArray(arr)) backupCodesLeft = arr.length;
    } catch { /* ignore */ }
  }
  const events = await db.loginEvent.findMany({
    where: { userId: user.id },
    orderBy: { at: "desc" },
    take: 12,
    select: { id: true, at: true, outcome: true, ip: true, ua: true, newDevice: true },
  });
  return NextResponse.json({
    totpEnabled: user.totpEnabled,
    emailVerified: user.emailVerified,
    mailConfigured: mailConfigured(),
    backupCodesLeft,
    loginEvents: events.map((e) => ({
      id: e.id,
      at: e.at.toISOString(),
      label: OUTCOME_LABEL[e.outcome] || e.outcome,
      device: uaLabel(e.ua),
      ip: e.ip,
      newDevice: e.newDevice,
    })),
  });
}
