import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mutate, readJson } from "@/lib/server/http";
import { existsSchema } from "@/lib/server/validation";

/** Step one of sign-in: does this email already have an account? */
export const POST = mutate(
  async (req: NextRequest) => {
    const { email } = existsSchema.parse(await readJson(req, 8 * 1024));
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    return NextResponse.json({ exists: Boolean(user) });
  },
  { limit: 20, windowMs: 5 * 60_000 },
);
