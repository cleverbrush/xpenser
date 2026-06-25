import type { MetadataRoute } from 'next';
import { webConfig } from '@/lib/config';
import { getPublicSitemap } from '@/lib/public-site';

export default function sitemap(): MetadataRoute.Sitemap {
    if (webConfig.singleUser?.enabled) {
        return [];
    }

    return getPublicSitemap();
}
