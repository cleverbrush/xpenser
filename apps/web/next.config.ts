import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@xpenser/ui'],
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
