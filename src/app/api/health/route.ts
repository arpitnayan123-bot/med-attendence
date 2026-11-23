import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Public response stays minimal; the full db status is gated behind a token
 *  so the health endpoint can't fingerprint the stack for strangers. */
export async function GET(req: NextRequest) {
  const expected = process.env.HEALTH_TOKEN;
  if (expected && req.headers.get("x-health-token") === expected) {
    let dbStatus = "up";
    try {
      await db.user.findFirst({ select: { id: true } });
    } catch {
      dbStatus = "down";
    }
    return NextResponse.json({ ok: dbStatus === "up", service: "attendmate-pro", db: dbStatus, time: new Date().toISOString() });
  }
  return NextResponse.json({ ok: true, service: "attendmate-pro" });
}
