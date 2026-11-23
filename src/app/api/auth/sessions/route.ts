import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  currentSessionId, getSessionUser, recordLoginEvent, revokeAllSessions, revokeSession, uaLabel,
} from "@/lib/server/auth";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { sessionRevokeSchema } from "@/lib/server/validation";

/** Device list: live sessions for this account, current one flagged. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, "Not signed in");
  const sid = await currentSessionId(req);
  const sessions = await db.session.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, ua: true, ip: true, createdAt: true, lastSeenAt: true },
  });
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      label: uaLabel(s.ua),
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      current: s.id === sid,
    })),
  });
}

/** Revoke one session ({id}) or every session including this one ({all:true}). */
export const DELETE = mutate(
  async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) return jsonError(401, "Not signed in");
    const body = sessionRevokeSchema.parse(await readJson(req, 2 * 1024));
    const sid = await currentSessionId(req);

    if ("all" in body) {
      await revokeAllSessions(user.id); // includes the current one — caller signs out
      return NextResponse.json({ ok: true, signedOut: true });
    }
    if (body.id === sid) {
      await revokeSession(body.id);
      await recordLoginEvent(user.id, "device_revoked", req);
      return NextResponse.json({ ok: true, signedOut: true });
    }
    const target = await db.session.findFirst({ where: { id: body.id, userId: user.id } });
    if (!target) return jsonError(404, "Session not found");
    await revokeSession(body.id);
    return NextResponse.json({ ok: true });
  },
  { limit: 20, windowMs: 60_000 },
);
