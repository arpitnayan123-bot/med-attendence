import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { clientIP, rateLimit } from "./rate-limit";

/**
 * Route helpers: uniform JSON errors, CSRF (origin + custom header) and
 * per-IP rate limiting for every mutating endpoint.
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
    // CSRF: same-origin check on Origin (sent on all cross-origin POSTs by browsers)
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        const o = new URL(origin);
        const host = req.headers.get("host");
        if (host && o.host !== host) return jsonError(403, "Cross-origin request blocked");
      } catch {
        return jsonError(403, "Invalid Origin");
      }
    }
    // custom header — cannot be attached cross-site without a CORS preflight
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
