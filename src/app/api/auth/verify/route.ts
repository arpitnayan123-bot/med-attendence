import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

/**
 * Email verification — single-use token from the sign-up mail marks the
 * account verified. Server-rendered HTML (the link arrives by email).
 */

const page = (title: string, body: string, ok: boolean) =>
  new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — AttendMate Pro</title><style>
body{font-family:ui-sans-serif,system-ui,sans-serif;background:#fff7ed;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
.card{background:#fff;border:1px solid #f3e7d9;border-radius:16px;padding:28px;max-width:420px;width:100%;box-shadow:0 8px 30px rgba(124,45,18,.08)}
h1{color:${ok ? "#166534" : "#7c2d12"};font-size:20px;margin:0 0 12px}p{color:#57534e;font-size:14px;line-height:1.5}
a{color:#ea580c}</style></head><body><div class="card"><h1>${title}</h1>${body}</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const row = token
    ? await db.authToken.findFirst({
        where: { kind: "verify", tokenHash: crypto.createHash("sha256").update(token).digest("hex") },
      })
    : null;
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return page(
      "Link invalid",
      `<p>This verification link is invalid, already used, or expired. Sign in to get a new one.</p><p><a href="/">← Back to sign-in</a></p>`,
      false,
    );
  }
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { emailVerified: true } }),
    db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  return page(
    "Email verified",
    `<p>Your email is confirmed — sync sign-in is active. See you on the dashboard.</p><p><a href="/">← Go to sign-in</a></p>`,
    true,
  );
}
