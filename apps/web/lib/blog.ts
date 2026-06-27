import { join } from 'node:path';
import { createReader } from '@keystatic/core/reader';
import type { Metadata, MetadataRoute } from 'next';
import keystaticConfig from '@/keystatic.config';
import {
    blogIndexPage,
    type JsonLdData,
    publicSiteOrigin,
    publicUrl
} from '@/lib/public-site';

export type BlogPost = {
    readonly content: string;
    readonly description: string;
    readonly draft: boolean;
    readonly keywords: readonly string[];
    readonly publishedAt: string;
    readonly slug: string;
    readonly targetKeyword: string;
    readonly title: string;
    readonly updatedAt: string | null;
};

const reader = createReader(getWebRoot(), keystaticConfig);

export function blogPostPath(slug: string): string {
    return `/blog/${slug}`;
}

export function formatBlogDate(date: string): string {
    return new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
        year: 'numeric'
    }).format(new Date(`${date}T00:00:00.000Z`));
}

export function getBlogPostKeywords(post: BlogPost): readonly string[] {
    return [post.targetKeyword, ...post.keywords].filter(
        (keyword, index, keywords) =>
            keyword.trim().length > 0 && keywords.indexOf(keyword) === index
    );
}

export function sortBlogPosts(posts: readonly BlogPost[]): BlogPost[] {
    return [...posts].sort((first, second) =>
        second.publishedAt.localeCompare(first.publishedAt)
    );
}

export function filterPublishedBlogPosts(
    posts: readonly BlogPost[]
): BlogPost[] {
    return sortBlogPosts(posts.filter(post => !post.draft));
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
    const entries = await reader.collections.blog.all();

    const posts = await Promise.all(
        entries.map(async ({ entry, slug }) => ({
            content: await entry.content(),
            description: entry.description,
            draft: entry.draft,
            keywords: normalizeKeywords(entry.keywords),
            publishedAt: entry.publishedAt,
            slug: entry.slug || slug,
            targetKeyword: entry.targetKeyword,
            title: entry.title,
            updatedAt: entry.updatedAt
        }))
    );

    return sortBlogPosts(posts);
}

export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
    return filterPublishedBlogPosts(await getAllBlogPosts());
}

export async function getPublishedBlogPost(
    slug: string
): Promise<BlogPost | null> {
    const posts = await getPublishedBlogPosts();

    return posts.find(post => post.slug === slug) ?? null;
}

export async function getBlogPostSitemap(): Promise<MetadataRoute.Sitemap> {
    const posts = await getPublishedBlogPosts();

    return posts.map(post => ({
        url: publicUrl(blogPostPath(post.slug)),
        lastModified: new Date(
            `${post.updatedAt ?? post.publishedAt}T00:00:00.000Z`
        ),
        changeFrequency: 'monthly',
        priority: 0.65
    }));
}

export function createBlogPostMetadata(post: BlogPost): Metadata {
    const canonical = publicUrl(blogPostPath(post.slug));
    const imageUrl = publicUrl('/og-image.png');
    const title = `${post.title} | xpenser blog`;

    return {
        title: post.title,
        description: post.description,
        alternates: {
            canonical
        },
        keywords: [...getBlogPostKeywords(post)],
        openGraph: {
            type: 'article',
            url: canonical,
            siteName: 'xpenser',
            title,
            description: post.description,
            publishedTime: `${post.publishedAt}T00:00:00.000Z`,
            modifiedTime: `${post.updatedAt ?? post.publishedAt}T00:00:00.000Z`,
            tags: [...getBlogPostKeywords(post)],
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt: 'xpenser personal finance app dashboard preview'
                }
            ]
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: post.description,
            images: [imageUrl]
        }
    };
}

export function createBlogIndexJsonLd(posts: readonly BlogPost[]): JsonLdData {
    const canonical = publicUrl(blogIndexPage.path);

    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${canonical}#collection`,
        url: canonical,
        name: blogIndexPage.metadataTitle,
        headline: blogIndexPage.h1,
        description: blogIndexPage.description,
        isPartOf: {
            '@type': 'WebSite',
            '@id': `${publicUrl('/')}#website`,
            name: 'xpenser',
            url: publicSiteOrigin
        },
        mainEntity: posts.map(post => ({
            '@type': 'BlogPosting',
            headline: post.title,
            url: publicUrl(blogPostPath(post.slug)),
            datePublished: `${post.publishedAt}T00:00:00.000Z`
        }))
    };
}

export function createBlogPostJsonLd(post: BlogPost): JsonLdData {
    const canonical = publicUrl(blogPostPath(post.slug));
    const modifiedAt = post.updatedAt ?? post.publishedAt;

    return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        '@id': `${canonical}#blogposting`,
        url: canonical,
        mainEntityOfPage: canonical,
        headline: post.title,
        description: post.description,
        datePublished: `${post.publishedAt}T00:00:00.000Z`,
        dateModified: `${modifiedAt}T00:00:00.000Z`,
        keywords: getBlogPostKeywords(post),
        image: publicUrl('/og-image.png'),
        author: {
            '@type': 'Organization',
            name: 'Cleverbrush',
            url: 'https://cleverbrush.com'
        },
        publisher: {
            '@type': 'Organization',
            name: 'Cleverbrush',
            url: 'https://cleverbrush.com'
        },
        isPartOf: {
            '@type': 'Blog',
            name: 'xpenser blog',
            url: publicUrl(blogIndexPage.path)
        }
    };
}

function getWebRoot(): string {
    const cwd = process.cwd();

    return cwd.endsWith('/apps/web') ? cwd : join(cwd, 'apps/web');
}

function normalizeKeywords(keywords: readonly string[]): readonly string[] {
    return keywords
        .map(keyword => keyword.trim())
        .filter(
            (keyword, index, normalizedKeywords) =>
                keyword.length > 0 &&
                normalizedKeywords.indexOf(keyword) === index
        );
}
