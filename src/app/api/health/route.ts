import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus = "up";
  try {
    await db.user.findFirst({ select: { id: true } });
  } catch {
    dbStatus = "down";
  }
  return NextResponse.json({
    ok: dbStatus === "up",
    service: "attendmate-pro",
    db: dbStatus,
    time: new Date().toISOString(),
  });
}
