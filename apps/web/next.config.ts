import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '20mb'
        }
    },
    transpilePackages: [
        '@xpenser/ui',
        '@xpenser/client',
        '@xpenser/contracts',
        '@xpenser/timezone'
    ],
    output: 'standalone'
};

export default nextConfig;
