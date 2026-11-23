import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, publicUser, verifyPassword } from "@/lib/server/auth";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { loginSchema } from "@/lib/server/validation";

export const POST = mutate(
  async (req: NextRequest) => {
    const body = loginSchema.parse(await readJson(req, 16 * 1024));
    const user = await db.user.findUnique({ where: { email: body.email } });
    // generic message — do not reveal whether the email exists
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return jsonError(401, "Invalid email or password");
    }
    await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    const res = NextResponse.json({ user: publicUser(user) });
    await createSession(res, user.id);
    return res;
  },
  { limit: 10, windowMs: 5 * 60_000 }, // 10 logins / 5 min / IP
);
