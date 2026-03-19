import type { NextConfig } from "next";

const commonSecurityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@cnbs/config", "@cnbs/domain", "@cnbs/ui"],
  poweredByHeader: false,
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: commonSecurityHeaders
      }
    ]);
  }
};

export default nextConfig;
