import type { MetadataRoute } from 'next';
import { getPublicSitemap } from '@/lib/public-site';

export default function sitemap(): MetadataRoute.Sitemap {
    return getPublicSitemap();
}
