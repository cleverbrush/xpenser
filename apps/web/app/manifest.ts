import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'xpenser',
        short_name: 'xpenser',
        description:
            'Open-source personal finance tracking for self-hosted workflows.',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f172a',
        icons: [
            {
                src: '/icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any'
            }
        ],
        shortcuts: [
            {
                name: 'Capture transaction',
                short_name: 'Capture',
                description: 'Add a transaction',
                url: '/capture',
                icons: [
                    {
                        src: '/icon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml'
                    }
                ]
            }
        ]
    };
}
