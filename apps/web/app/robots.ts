import type { MetadataRoute } from 'next';
import { publicUrl } from '@/lib/public-site';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/api/',
                '/external-api/',
                '/auth/',
                '/mcp/oauth/',
                '/dashboard',
                '/transactions',
                '/capture',
                '/vendors',
                '/settings',
                '/setup'
            ]
        },
        sitemap: publicUrl('/sitemap.xml')
    };
}
