import "server-only";

/**
 * Transactional email: Resend HTTP API when RESEND_API_KEY is set, otherwise a
 * console fallback for local/self-hosted deployments (the server operator can
 * pick links out of the log). Every email path degrades gracefully — callers
 * must keep working (and keep their generic responses) when mail is absent.
 */

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

const FROM = process.env.MAIL_FROM || "AttendMate <onboarding@resend.dev>";

export interface MailResult {
  delivered: boolean;
}

async function send(to: string, subject: string, html: string): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mail] NOT CONFIGURED — to: ${to} | subject: ${subject}\n${html}`);
    return { delivered: false };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error(`[mail] resend rejected (${res.status}) for ${to}`);
      return { delivered: false };
    }
    return { delivered: true };
  } catch (err) {
    console.error("[mail] send failed:", err);
    return { delivered: false };
  }
}

const shell = (title: string, body: string) => `
<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;background:#fffaf5;border:1px solid #f3e7d9;border-radius:16px;padding:28px">
  <h2 style="color:#7c2d12;margin:0 0 12px">${title}</h2>
  ${body}
  <p style="color:#a8a29e;font-size:12px;margin-top:24px">AttendMate Pro — NSMCH Phase-III attendance tracker. If you didn't request this, ignore this email.</p>
</div>`;

export function sendVerificationMail(to: string, verifyUrl: string) {
  return send(
    to,
    "Verify your AttendMate Pro email",
    shell("Confirm your email", `<p>Welcome to AttendMate Pro. Confirm this address to activate sync:</p><p><a href="${verifyUrl}" style="display:inline-block;background:#ea580c;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:700">Verify email</a></p><p style="font-size:12px;color:#78716c">Or paste this link: ${verifyUrl}</p>`),
  );
}

export function sendResetMail(to: string, resetUrl: string) {
  return send(
    to,
    "Reset your AttendMate Pro password",
    shell("Password reset", `<p>Click below to choose a new password. The link expires in 15 minutes and can be used once.</p><p><a href="${resetUrl}" style="display:inline-block;background:#ea580c;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:700">Reset password</a></p><p style="font-size:12px;color:#78716c">Or paste this link: ${resetUrl}</p>`),
  );
}

export function sendNewDeviceAlert(to: string, ua: string, ip: string, when: string) {
  return send(
    to,
    "New device signed in to AttendMate Pro",
    shell("New device sign-in", `<p>Your account was just signed in from a device we haven't seen before:</p><p style="font-size:13px;color:#57534e">Device: <b>${ua}</b><br/>IP: <b>${ip}</b><br/>Time: <b>${when}</b></p><p>If this wasn't you, sign out everywhere from Settings → Security and change your password immediately.</p>`),
  );
}
