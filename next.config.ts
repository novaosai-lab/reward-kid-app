import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve the app at /reward/* on the cloudflared tunnel
  basePath: '/reward',
  // Prevent Next.js from picking up workspace root lockfile
  experimental: {
    turbopack: {
      root: '/Users/nova/.openclaw/workspace/reward-kid-app',
    },
  },
};

export default nextConfig;
