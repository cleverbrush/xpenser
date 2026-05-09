import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    transpilePackages: ['@xpenser/ui', '@xpenser/client', '@xpenser/contracts'],
    output: 'standalone'
};

export default nextConfig;
