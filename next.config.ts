import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from picking up workspace root lockfile
  experimental: {
    turbopack: {
      root: '/Users/nova/.openclaw/workspace/reward-kid-app',
    },
  },
};

export default nextConfig;
