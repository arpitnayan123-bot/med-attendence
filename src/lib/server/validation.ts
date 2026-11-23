import "server-only";
import { z } from "zod";

/** Shared request validation — credentials & security only (no data sync). */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "Enter your email")
  .max(120)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password too long");

export const registerSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2, "Enter your name").max(60),
  rollNo: z.coerce.number().int("Roll number must be a whole number").min(1, "Roll number must be between 1 and 100").max(100, "Roll number must be between 1 and 100"),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(72),
});

export const existsSchema = z.object({ email: emailSchema });

/* ---------- security (2FA / sessions / step-up) ---------- */

export const totpCodeSchema = z
  .string()
  .trim()
  .refine((v) => /^\d{6}$/.test(v.replace(/\s/g, "")), "Enter the 6-digit code");

export const backupCodeSchema = z
  .string()
  .trim()
  .refine((v) => /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(v.replace(/\s/g, "").toUpperCase()), "Invalid backup code");

/** TOTP step at login: a 6-digit authenticator code or a backup code. */
export const totpVerifySchema = z.object({ code: z.string().trim().min(6).max(16) });

export const twoFaEnableSchema = z.object({ code: totpCodeSchema });

export const twoFaDisableSchema = z.object({ password: z.string().min(1).max(72), code: totpCodeSchema });

export const backupRegenSchema = z.object({ password: z.string().min(1).max(72) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
  code: totpCodeSchema.optional(),
});

export const sessionRevokeSchema = z.union([
  z.object({ id: z.string().min(1).max(64) }),
  z.object({ all: z.literal(true) }),
]);

/** Step-up proof attached to destructive actions on the user's own device. */
export const stepUpSchema = z.object({
  password: z.string().min(1, "Confirm with your password").max(72),
  code: z.string().trim().min(6).max(16).optional(),
});

export const resetConfirmSchema = z.object({
  token: z.string().min(10).max(128),
  newPassword: passwordSchema,
});
