import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIP, rateLimit } from "@/lib/server/rate-limit";
import { getGroupInfo } from "@/lib/attendmate/engine";
import { jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Roll-number availability for sign-up — every student gets exactly one roll
 * (uniqueness is enforced on register; this lets the UI confirm before submit).
 * Returns only "taken or free" plus the public roll→sub-group mapping:
 * never any name or email, so nothing about other students leaks.
 */
export const GET = async (req: NextRequest) => {
  const rl = rateLimit(`roll-check:${clientIP(req)}`, 30, 60_000); // 30 checks / min / IP
  if (!rl.ok) return jsonError(429, "Too many checks — try again shortly");

  const roll = Number(new URL(req.url).searchParams.get("roll"));
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) {
    return jsonError(400, "Roll number must be a whole number between 1 and 100");
  }

  const taken = (await db.user.findUnique({ where: { rollNo: roll } })) !== null;
  const gi = getGroupInfo(roll);
  return NextResponse.json({ roll, taken, group: gi.group, subGroup: gi.subGroup });
};
