import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    experimental: {
        proxyClientMaxBodySize: 20 * 1024 * 1024,
        serverActions: {
            bodySizeLimit: '20mb'
        },
        useTypeScriptCli: true
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'www.superlaun.ch',
                port: '',
                pathname: '/badge.png',
                search: ''
            }
        ]
    },
    transpilePackages: [
        '@xpenser/ui',
        '@xpenser/client',
        '@xpenser/contracts',
        '@xpenser/timezone'
    ],
    output: 'standalone',
    async rewrites() {
        return [
            {
                source: '/.well-known/:path*',
                destination: '/api/.well-known/:path*'
            }
        ];
    }
};

export default nextConfig;
