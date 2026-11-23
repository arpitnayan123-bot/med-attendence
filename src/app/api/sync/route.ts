import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/server/auth";
import { jsonError, mutate, readJson } from "@/lib/server/http";
import { syncPushSchema, SyncOp } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

/* GET — full server snapshot for the signed-in account */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, "Not signed in");
  const [logs, baselines, modules] = await Promise.all([
    db.attendanceLog.findMany({ where: { userId: user.id }, orderBy: [{ date: "asc" }, { slotId: "asc" }] }),
    db.baseline.findMany({ where: { userId: user.id } }),
    db.moduleDone.findMany({ where: { userId: user.id } }),
  ]);
  return NextResponse.json({
    serverTime: new Date().toISOString(),
    profile: {
      email: user.email,
      name: user.name,
      rollNo: user.rollNo,
      theoryTarget: user.theoryTarget,
      clinicalTarget: user.clinicalTarget,
      theme: user.theme,
      updatedAt: user.updatedAt.toISOString(),
    },
    logs: logs.map((l) => ({
      date: l.date, slotId: l.slotId, status: l.status,
      subject: l.subject, kind: l.kind, updatedAt: l.updatedAt.toISOString(),
    })),
    baselines: baselines.map((b) => ({
      code: b.code,
      theoryPresent: b.theoryPresent, theoryTotal: b.theoryTotal,
      clinicalPresent: b.clinicalPresent, clinicalTotal: b.clinicalTotal,
      updatedAt: b.updatedAt.toISOString(),
    })),
    modules: modules.map((m) => ({ key: m.moduleKey, updatedAt: m.updatedAt.toISOString() })),
  });
}

/* POST — apply a batch of client ops (offline queue flush / initial import) */
export const POST = mutate(
  async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) return jsonError(401, "Not signed in");
    const { ops } = syncPushSchema.parse(await readJson(req));

    let applied = 0;
    await db.$transaction(async (tx) => {
      for (const op of ops) {
        await applyOp(tx, user.id, op);
        applied++;
      }
    });
    return NextResponse.json({ applied, serverTime: new Date().toISOString() });
  },
  { limit: 60, windowMs: 60_000 },
);

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function applyOp(tx: Tx, userId: string, op: SyncOp) {
  switch (op.t) {
    case "log.set": {
      await tx.attendanceLog.upsert({
        where: { userId_date_slotId: { userId, date: op.date, slotId: op.slotId } },
        create: { userId, date: op.date, slotId: op.slotId, status: op.status, subject: op.subject ?? null, kind: op.kind ?? null, updatedAt: new Date() },
        update: { status: op.status, subject: op.subject ?? null, kind: op.kind ?? null, updatedAt: new Date() },
      });
      return;
    }
    case "log.del": {
      await tx.attendanceLog.deleteMany({ where: { userId, date: op.date, slotId: op.slotId } });
      return;
    }
    case "baseline.set": {
      if (op.b === null) {
        await tx.baseline.deleteMany({ where: { userId, code: op.code } });
      } else {
        await tx.baseline.upsert({
          where: { userId_code: { userId, code: op.code } },
          create: { userId, code: op.code, theoryPresent: op.b.tp, theoryTotal: op.b.tt, clinicalPresent: op.b.cp, clinicalTotal: op.b.ct, updatedAt: new Date() },
          update: { theoryPresent: op.b.tp, theoryTotal: op.b.tt, clinicalPresent: op.b.cp, clinicalTotal: op.b.ct, updatedAt: new Date() },
        });
      }
      return;
    }
    case "module.set": {
      if (op.done) {
        await tx.moduleDone.upsert({
          where: { userId_moduleKey: { userId, moduleKey: op.key } },
          create: { userId, moduleKey: op.key, updatedAt: new Date() },
          update: { updatedAt: new Date() },
        });
      } else {
        await tx.moduleDone.deleteMany({ where: { userId, moduleKey: op.key } });
      }
      return;
    }
    case "profile.set": {
      await tx.user.update({ where: { id: userId }, data: op.patch });
      return;
    }
  }
}

/* DELETE — wipe this account's attendance data (account itself is kept) */
export const DELETE = mutate(
  async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) return jsonError(401, "Not signed in");
    await db.$transaction([
      db.attendanceLog.deleteMany({ where: { userId: user.id } }),
      db.baseline.deleteMany({ where: { userId: user.id } }),
      db.moduleDone.deleteMany({ where: { userId: user.id } }),
      db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }),
    ]);
    return NextResponse.json({ ok: true });
  },
  { limit: 5, windowMs: 60_000 },
);
