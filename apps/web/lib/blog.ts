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
    readonly heroImage: string | null;
    readonly heroImageAlt: string | null;
    readonly keywords: readonly string[];
    readonly publishedAt: string;
    readonly slug: string;
    readonly sourcePrNumber: number | null;
    readonly sourcePrUrl: string | null;
    readonly targetKeyword: string;
    readonly title: string;
    readonly updatedAt: string | null;
};

export type BlogPostImage = {
    readonly alt: string;
    readonly path: string;
    readonly url: string;
};

const defaultBlogImage = {
    alt: 'xpenser personal finance app dashboard preview',
    path: '/og-image.png'
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
            heroImage: normalizeOptionalText(entry.heroImage),
            heroImageAlt: normalizeOptionalText(entry.heroImageAlt),
            keywords: normalizeKeywords(entry.keywords),
            publishedAt: entry.publishedAt,
            slug: entry.slug || slug,
            sourcePrNumber: normalizeOptionalNumber(entry.sourcePrNumber),
            sourcePrUrl: normalizeOptionalText(entry.sourcePrUrl),
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

export function getBlogPostImage(post: BlogPost): BlogPostImage {
    const imagePath = post.heroImage ?? defaultBlogImage.path;
    const alt =
        post.heroImageAlt ??
        (post.heroImage
            ? `${post.title} screenshot from xpenser`
            : defaultBlogImage.alt);

    return {
        alt,
        path: imagePath,
        url: publicUrl(imagePath)
    };
}

export function createBlogPostMetadata(post: BlogPost): Metadata {
    const canonical = publicUrl(blogPostPath(post.slug));
    const image = getBlogPostImage(post);
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
                    url: image.url,
                    width: 1200,
                    height: 630,
                    alt: image.alt
                }
            ]
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: post.description,
            images: [image.url]
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
            datePublished: `${post.publishedAt}T00:00:00.000Z`,
            image: getBlogPostImage(post).url
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
        image: getBlogPostImage(post).url,
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

function normalizeOptionalText(
    value: string | null | undefined
): string | null {
    const normalized = value?.trim();

    return normalized ? normalized : null;
}

function normalizeOptionalNumber(
    value: number | string | null | undefined
): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    const normalized = value?.trim();

    if (!normalized) {
        return null;
    }

    const number = Number.parseInt(normalized, 10);

    return Number.isFinite(number) ? number : null;
}
