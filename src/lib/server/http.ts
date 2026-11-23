import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { clientIP, rateLimit } from "./rate-limit";

/**
 * Route helpers: uniform JSON errors, CSRF (custom header) and per-IP rate
 * limiting for every mutating endpoint.
 */

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

/** Wraps a mutating handler with CSRF + rate limiting. */
export function mutate<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>,
  opts: { limit: number; windowMs: number; requireCsrf?: boolean },
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    // CSRF: the custom header is the gate — cross-site requests cannot attach
    // it without a CORS preflight, and no endpoint here answers one. An
    // Origin-vs-Host comparison used to run as well, but the sandboxed preview
    // proxy chain rewrites Host, so the browser's real Origin never matched
    // and every sign-in from the preview window was 403'd. The header gate is
    // the part that actually defends against CSRF; keep it strict.
    if (opts.requireCsrf !== false && req.headers.get("x-am-csrf") !== "1") {
      return jsonError(403, "Missing CSRF header");
    }
    const rl = rateLimit(`${req.nextUrl.pathname}:${clientIP(req)}`, opts.limit, opts.windowMs);
    if (!rl.ok) {
      return jsonError(429, `Too many requests — try again in ${rl.retryAfterSec}s`, {
        retryAfter: rl.retryAfterSec,
      });
    }
    try {
      return await handler(req, ...args);
    } catch (err) {
      if (err instanceof ZodError) {
        const msg = err.issues[0]?.message || "Invalid input";
        return jsonError(400, msg);
      }
      if (err instanceof PayloadTooLarge) {
        return jsonError(413, "Payload too large");
      }
      console.error(`[api] ${req.nextUrl.pathname} failed:`, err);
      return jsonError(500, "Internal server error");
    }
  };
}

/** Parses and size-caps a JSON body. */
export async function readJson(req: NextRequest, maxBytes = 512 * 1024): Promise<unknown> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw new PayloadTooLarge();
  const text = await req.text();
  if (text.length > maxBytes) throw new PayloadTooLarge();
  return JSON.parse(text);
}
export class PayloadTooLarge extends Error {
  constructor() {
    super("Payload too large");
  }
}
