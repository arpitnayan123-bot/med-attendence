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

export type SyncOp = z.infer<typeof syncOpSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
