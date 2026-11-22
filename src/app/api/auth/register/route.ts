import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword, publicUser } from "@/lib/server/auth";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { registerSchema } from "@/lib/server/validation";

export const POST = mutate(
  async (req: NextRequest) => {
    const body = registerSchema.parse(await readJson(req, 16 * 1024));
    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) return jsonError(409, "An account with this email already exists — sign in instead");

    const user = await db.user.create({
      data: {
        email: body.email,
        name: body.name,
        rollNo: body.rollNo,
        passwordHash: await hashPassword(body.password),
      },
    });
    const res = NextResponse.json({ user: publicUser(user) }, { status: 201 });
    await createSession(res, user.id);
    return res;
  },
  { limit: 5, windowMs: 10 * 60_000 }, // 5 registrations / 10 min / IP
);
