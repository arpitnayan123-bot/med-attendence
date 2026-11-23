import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, hashPassword, publicUser } from "@/lib/server/auth";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { registerSchema } from "@/lib/server/validation";
import { mailConfigured, sendVerificationMail } from "@/lib/server/mail";

export const POST = mutate(
  async (req: NextRequest) => {
    const body = registerSchema.parse(await readJson(req, 16 * 1024));
    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) return jsonError(409, "An account with this email already exists — sign in instead");
    const rollTaken = await db.user.findUnique({ where: { rollNo: body.rollNo } });
    if (rollTaken) {
      return jsonError(409, "This roll number is already registered to another account — each student gets exactly one");
    }

    // Identity: email ownership is proven when a mailer is configured; until
    // then verification is skipped so offline/self-hosted deployments work.
    const mailOn = mailConfigured();

    let user;
    try {
      user = await db.user.create({
        data: {
          email: body.email,
          name: body.name,
          rollNo: body.rollNo,
          passwordHash: await hashPassword(body.password),
          emailVerified: !mailOn,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return jsonError(409, "This email or roll number is already registered");
      }
      throw err;
    }

    if (mailOn) {
      const token = crypto.randomBytes(32).toString("hex");
      await db.authToken.create({
        data: {
          userId: user.id,
          kind: "verify",
          tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 48 * 60 * 60_000),
        },
      });
      const origin = req.headers.get("origin") || new URL(req.url).origin;
      void sendVerificationMail(user.email, `${origin}/api/auth/verify?token=${token}`);
    }

    const res = NextResponse.json({ user: publicUser(user), verifyEmail: mailOn }, { status: 201 });
    await createSession(res, user.id, req);
    return res;
  },
  { limit: 5, windowMs: 10 * 60_000 }, // 5 registrations / 10 min / IP
);
