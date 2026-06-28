import type { MetadataRoute } from 'next';
import { getBlogPostSitemap } from '@/lib/blog';
import { webConfig } from '@/lib/config';
import { getPublicSitemap } from '@/lib/public-site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    if (webConfig.singleUser?.enabled) {
        return [];
    }

    return [...getPublicSitemap(), ...(await getBlogPostSitemap())];
}
