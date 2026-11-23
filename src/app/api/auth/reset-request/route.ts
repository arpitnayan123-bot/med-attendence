import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { emailSchema } from "@/lib/server/validation";
import { mailConfigured, sendResetMail } from "@/lib/server/mail";

/**
 * Password reset step 1 — always answers the same way, whether or not the
 * email exists (no account enumeration). Tokens: single-use, 15 minutes,
 * sha256-hashed at rest. Without a configured mailer the link is logged to the
 * server console so the self-hosted operator can still recover an account.
 */
export const POST = mutate(
  async (req: NextRequest) => {
    const { email } = (await readJson(req, 4 * 1024)) as { email?: string };
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return jsonError(400, "Enter a valid email address");

    const generic = { ok: true, message: "If that email has an account and mail is configured, a reset link is on its way." };
    const user = await db.user.findUnique({ where: { email: parsed.data } });
    if (!user) return NextResponse.json(generic);

    const token = crypto.randomBytes(32).toString("hex");
    await db.authToken.create({
      data: {
        userId: user.id,
        kind: "reset",
        tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });

    const origin = req.headers.get("origin") || new URL(req.url).origin;
    const resetUrl = `${origin}/api/auth/reset?token=${token}`;
    const { delivered } = await sendResetMail(user.email, resetUrl);
    if (!delivered) {
      console.log(`[auth] mail not configured — reset link for ${user.email}: ${resetUrl}`);
    }
    return NextResponse.json(generic);
  },
  { limit: 5, windowMs: 10 * 60_000 },
);
