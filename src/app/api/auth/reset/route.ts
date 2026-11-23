import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { mutate, readJson } from "@/lib/server/http";
import { resetConfirmSchema } from "@/lib/server/validation";
import { recordLoginEvent, revokeAllSessions } from "@/lib/server/auth";
import { hashPassword } from "@/lib/server/auth";

/**
 * Password reset step 2 — consumes a single-use token (arrives as a query on
 * the GET form, then a hidden field on the POST) and sets the new password.
 * All sessions are revoked and the account is unlocked. Plain HTML pages: the
 * link comes from an email, so no SPA routing or CSRF header is involved.
 */

const page = (title: string, body: string, ok: boolean) =>
  new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — AttendMate Pro</title><style>
body{font-family:ui-sans-serif,system-ui,sans-serif;background:#fff7ed;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
.card{background:#fff;border:1px solid #f3e7d9;border-radius:16px;padding:28px;max-width:420px;width:100%;box-shadow:0 8px 30px rgba(124,45,18,.08)}
h1{color:#7c2d12;font-size:20px;margin:0 0 12px}p{color:#57534e;font-size:14px;line-height:1.5}
input{width:100%;padding:10px 12px;border:1px solid #d6d3d1;border-radius:10px;font-size:14px;margin:6px 0 14px}
button{width:100%;padding:11px;background:#ea580c;color:#fff;border:0;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer}
a{color:#ea580c}</style></head><body><div class="card"><h1>${title}</h1>${body}</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );

async function consumeToken(token: string) {
  const row = await db.authToken.findFirst({
    where: { kind: "reset", tokenHash: crypto.createHash("sha256").update(token).digest("hex") },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/** GET — renders the "choose a new password" form when the token is valid. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const row = token ? await consumeToken(token) : null;
  if (!row) {
    return page(
      "Link expired",
      `<p>This reset link is invalid, already used, or older than 15 minutes. Request a fresh one from the sign-in page.</p><p><a href="/">← Back to sign-in</a></p>`,
      false,
    );
  }
  return page(
    "Choose a new password",
    `<p>Pick a strong password — at least 8 characters. Signing out everywhere is automatic.</p>
<form method="POST" action="/api/auth/reset">
<input type="hidden" name="token" value="${token}">
<input type="password" name="newPassword" placeholder="New password (min 8 characters)" required minlength="8" maxlength="72" autocomplete="new-password">
<button type="submit">Set new password</button>
</form>`,
    true,
  );
}

/** POST — sets the password, revokes every session, unlocks the account. */
export const POST = mutate(
  async (req: NextRequest) => {
    let body: Record<string, unknown>;
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      body = (await readJson(req, 4 * 1024)) as Record<string, unknown>;
    } else {
      body = Object.fromEntries((await req.formData()).entries());
    }
    const parsed = resetConfirmSchema.safeParse({ token: body.token, newPassword: body.newPassword });
    if (!parsed.success) {
      return page("Invalid input", "<p>Your new password must be at least 8 characters. Go back and try again.</p>", false);
    }
    const row = await consumeToken(parsed.data.token);
    if (!row) {
      return page(
        "Link expired",
        `<p>This reset link is invalid, already used, or older than 15 minutes. Request a fresh one from the sign-in page.</p><p><a href="/">← Back to sign-in</a></p>`,
        false,
      );
    }
    await db.$transaction([
      db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(parsed.data.newPassword), failedAttempts: 0, totpFailedAttempts: 0, lockedUntil: null } }),
      db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    await revokeAllSessions(row.userId);
    await recordLoginEvent(row.userId, "reset", req);
    return page(
      "Password updated",
      `<p>Your password has been changed and all signed-in devices were signed out.</p><p><a href="/">← Go to sign-in</a></p>`,
      true,
    );
  },
  { limit: 10, windowMs: 60_000, requireCsrf: false },
);
