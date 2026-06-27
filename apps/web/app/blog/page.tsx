import { redirect } from 'next/navigation';
import { BlogIndexPage } from '@/components/blog-pages';
import { JsonLdScript } from '@/components/json-ld';
import { createBlogIndexJsonLd, getPublishedBlogPosts } from '@/lib/blog';
import { webConfig } from '@/lib/config';
import { blogIndexPage, createPublicPageMetadata } from '@/lib/public-site';

export const dynamic = 'force-dynamic';
export const metadata = createPublicPageMetadata(blogIndexPage);

export default async function BlogRoutePage() {
    if (webConfig.singleUser?.enabled) {
        redirect('/dashboard');
    }

    const posts = await getPublishedBlogPosts();

    return (
        <>
            <JsonLdScript data={createBlogIndexJsonLd(posts)} />
            <BlogIndexPage posts={posts} />
        </>
    );
}
