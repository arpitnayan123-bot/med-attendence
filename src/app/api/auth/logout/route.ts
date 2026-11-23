import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/server/auth";
import { mutate } from "@/lib/server/http";

export const POST = mutate(
  async () => {
    const res = NextResponse.json({ ok: true });
    await clearSession(res);
    return res;
  },
  { limit: 30, windowMs: 5 * 60_000 },
);
