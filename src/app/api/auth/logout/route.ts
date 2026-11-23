import { NextRequest, NextResponse } from "next/server";
import { clearSession, currentSessionId, revokeSession } from "@/lib/server/auth";
import { mutate } from "@/lib/server/http";

/** Signs out: revokes the server-side session (so the cookie is dead even if copied) + clears it. */
export const POST = mutate(
  async (req: NextRequest) => {
    const sid = await currentSessionId(req);
    if (sid) await revokeSession(sid);
    const res = NextResponse.json({ ok: true });
    await clearSession(res);
    return res;
  },
  { limit: 30, windowMs: 5 * 60_000 },
);
