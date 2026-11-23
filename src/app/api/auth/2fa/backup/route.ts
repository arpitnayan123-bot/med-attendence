import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, verifyPassword } from "@/lib/server/auth";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { hashBackupCode, newBackupCodes } from "@/lib/server/totp";
import { backupRegenSchema } from "@/lib/server/validation";

/** Replaces the backup-code set. Requires the password; plaintext shown once. */
export const POST = mutate(
  async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) return jsonError(401, "Not signed in");
    if (!user.totpEnabled) return jsonError(409, "Enable two-factor authentication first");
    const { password } = backupRegenSchema.parse(await readJson(req, 4 * 1024));

    if (!(await verifyPassword(password, user.passwordHash))) {
      return jsonError(401, "Incorrect password");
    }

    const backupCodes = newBackupCodes();
    await db.user.update({
      where: { id: user.id },
      data: { backupCodes: JSON.stringify(backupCodes.map(hashBackupCode)) },
    });
    return NextResponse.json({ backupCodes });
  },
  { limit: 5, windowMs: 60_000 },
);
