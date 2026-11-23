import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Production quality gates: type errors must fail the build, strict mode
  // surfaces unsafe effects in development. Never ship with these off.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // Baseline security headers for every response (app + API).
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    // Strict-ish CSP: everything self-hosted, no third-party origins, framing
    // and object embedding denied. Inline scripts/styles stay allowed — the
    // theme pre-paint runs before hydration and Next injects build-varying
    // inline bootstrap scripts whose bytes change every build (hash-pinning
    // them would break each deploy).
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
