import "server-only";
import { z } from "zod";

/** Shared request validation. All limits documented inline. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_ID_RE = /^[a-z]{3}-(09|14|15|16|cp)$|^x-[a-z0-9]{4,12}$/;

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

export const profilePatchSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    rollNo: z.coerce.number().int().min(1).max(100).optional(),
    theoryTarget: z.coerce.number().int().min(1).max(100).optional(),
    clinicalTarget: z.coerce.number().int().min(1).max(100).optional(),
    theme: z.enum(["light", "dark"]).optional(),
  })
  .strict();

export const logSetSchema = z.object({
  date: z.string().regex(DATE_RE, "Invalid date"),
  slotId: z.string().regex(SLOT_ID_RE, "Invalid slot"),
  status: z.enum(["present", "absent", "cancelled"]),
  subject: z.string().trim().regex(/^(CP|[A-Z]{2,6})$/).max(8).nullable().optional(),
  kind: z.enum(["theory", "clinical"]).nullable().optional(),
});
export const logDelSchema = z.object({
  date: z.string().regex(DATE_RE),
  slotId: z.string().regex(SLOT_ID_RE),
});
export const baselineSetSchema = z.object({
  code: z.string().regex(/^[A-Z]{2,6}$/, "Invalid subject code"),
  b: z.object({
    tp: z.number().int().min(0).max(10000),
    tt: z.number().int().min(0).max(10000),
    cp: z.number().int().min(0).max(10000),
    ct: z.number().int().min(0).max(10000),
  }).nullable(),
});
export const moduleSetSchema = z.object({
  key: z.string().regex(/^(aetcom|pandemic):[A-Za-z0-9.\-]{1,10}$/, "Invalid module key"),
  done: z.boolean(),
});
export const profileSetSchema = z.object({ patch: profilePatchSchema });

export const syncOpSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("log.set"), ...logSetSchema.shape }),
  z.object({ t: z.literal("log.del"), ...logDelSchema.shape }),
  z.object({ t: z.literal("baseline.set"), ...baselineSetSchema.shape }),
  z.object({ t: z.literal("module.set"), ...moduleSetSchema.shape }),
  z.object({ t: z.literal("profile.set"), ...profileSetSchema.shape }),
]);

export const syncPushSchema = z.object({
  ops: z.array(syncOpSchema).max(500, "Too many changes in one batch"),
});

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

/** Step-up proof attached to sensitive actions (e.g. Reset all data). */
export const stepUpSchema = z.object({
  password: z.string().min(1, "Confirm with your password").max(72),
  code: z.string().trim().min(6).max(16).optional(),
});

export const resetConfirmSchema = z.object({
  token: z.string().min(10).max(128),
  newPassword: passwordSchema,
});

export type SyncOp = z.infer<typeof syncOpSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
