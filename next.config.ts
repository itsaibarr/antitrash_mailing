import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@vercel/postgres'],
};

export default nextConfig;
