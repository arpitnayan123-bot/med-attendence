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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
