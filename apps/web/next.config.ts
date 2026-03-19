import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@cnbs/charts", "@cnbs/config", "@cnbs/domain", "@cnbs/ui"]
};

export default nextConfig;
