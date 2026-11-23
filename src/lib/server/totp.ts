import "server-only";
import crypto from "crypto";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";

/**
 * TOTP two-factor authentication (RFC 6238, SHA-1 / 6 digits / 30 s — the
 * defaults every authenticator app expects), one-time backup codes, and
 * AES-256-GCM encryption for the stored TOTP secrets (key derived from
 * AUTH_SECRET, so a DB leak alone does not expose the seeds).
 */

const TOTP_ISSUER = "AttendMate Pro";
const BACKUP_CODE_COUNT = 10;
const BACKUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1 — unambiguous to read

export const TOTP_WINDOW = 1; // ±30 s clock drift tolerance

function encKey(): Buffer {
  const s = process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me";
  return crypto.createHash("sha256").update(`totp:${s}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptSecret(blob: string): string | null {
  try {
    const raw = Buffer.from(blob, "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function totpUri(email: string, secretBase32: string): string {
  const totp = new TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  return totp.toString();
}

export async function totpQrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#1c1917", light: "#ffffff" } });
}

/** Returns true when the 6-digit code is currently valid (±1 step). */
export function verifyTotp(secretBase32: string, token: string): boolean {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const totp = new TOTP({
    issuer: TOTP_ISSUER,
    label: "verify",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  return totp.validate({ token: clean, window: TOTP_WINDOW }) !== null;
}

/** Human-friendly one-time codes, e.g. "K7MP-W3RT". */
export function newBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(8);
    let s = "";
    for (let j = 0; j < 8; j++) s += BACKUP_ALPHABET[bytes[j] % BACKUP_ALPHABET.length];
    codes.push(`${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(code.replace(/\s|-/g, "").toUpperCase()).digest("hex");
}

/** Checks a presented code against the stored hashes; removes a match. Returns the pruned hash list or null (no match). */
export function consumeBackupCode(presented: string, hashesJson: string | null): string[] | null {
  if (!hashesJson) return null;
  let hashes: string[];
  try {
    const parsed = JSON.parse(hashesJson);
    if (!Array.isArray(parsed)) return null;
    hashes = parsed.filter((h) => typeof h === "string");
  } catch {
    return null;
  }
  const h = hashBackupCode(presented);
  if (!hashes.includes(h)) return null;
  return hashes.filter((x) => x !== h);
}
