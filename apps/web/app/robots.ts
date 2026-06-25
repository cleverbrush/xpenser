import type { MetadataRoute } from 'next';
import { webConfig } from '@/lib/config';
import { publicUrl } from '@/lib/public-site';

export default function robots(): MetadataRoute.Robots {
    if (webConfig.singleUser?.enabled) {
        return {
            rules: {
                userAgent: '*',
                disallow: '/'
            }
        };
    }

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/api/',
                '/app-api/',
                '/auth/',
                '/authjs/',
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
