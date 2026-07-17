import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { BlogPostPage } from '@/components/blog-pages';
import { JsonLdScript } from '@/components/json-ld';
import { mdxComponents } from '@/components/mdx-components';
import {
    createBlogPostJsonLd,
    createBlogPostMetadata,
    getPublishedBlogPost,
    getPublishedBlogPosts
} from '@/lib/blog';
import { webConfig } from '@/lib/config';
import { blogMdxOptions } from '@/lib/mdx';

type BlogPostRouteProps = {
    readonly params: Promise<{
        readonly slug: string;
    }>;
};

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
    const posts = await getPublishedBlogPosts();

    return posts.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({
    params
}: BlogPostRouteProps): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPublishedBlogPost(slug);

    if (!post) {
        return {};
    }

    return createBlogPostMetadata(post);
}

export default async function BlogPostRoutePage({
    params
}: BlogPostRouteProps) {
    if (webConfig.singleUser?.enabled) {
        redirect('/dashboard');
    }

    const { slug } = await params;
    const post = await getPublishedBlogPost(slug);

    if (!post) {
        notFound();
    }

    return (
        <>
            <JsonLdScript data={createBlogPostJsonLd(post)} />
            <BlogPostPage post={post}>
                <MDXRemote
                    components={mdxComponents}
                    options={blogMdxOptions}
                    source={post.content}
                />
            </BlogPostPage>
        </>
    );
}
