import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript errors still block the build (they're real bugs).
  // ESLint stylistic warnings should not break a personal deploy — lint
  // locally with `npm run lint` when you want the full report.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
