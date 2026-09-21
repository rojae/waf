import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/auth/google/login',
        destination: '/api/auth/google/login',
      },
    ];
  },
};

export default nextConfig;
