import { describe, expect, it } from 'vitest';
import {
    type BlogPost,
    blogPostPath,
    createBlogIndexJsonLd,
    createBlogPostJsonLd,
    createBlogPostMetadata,
    filterPublishedBlogPosts,
    formatBlogDate,
    getBlogPostKeywords,
    getBlogPostSitemap,
    getPublishedBlogPost,
    getPublishedBlogPosts
} from './blog';

describe('blog helpers', () => {
    it('reads published blog posts from MDX content', async () => {
        const posts = await getPublishedBlogPosts();

        expect(posts.map(post => post.slug)).toContain(
            'markdown-blog-workflow'
        );
        expect(posts.every(post => !post.draft)).toBe(true);
        expect(posts[0]?.content).toContain(
            'xpenser now has a Markdown blog workflow'
        );
    });

    it('finds a published post by slug', async () => {
        const post = await getPublishedBlogPost('markdown-blog-workflow');

        expect(post?.title).toBe(
            'Markdown blog workflow for xpenser feature releases'
        );
        expect(post?.targetKeyword).toBe('markdown blog workflow');
    });

    it('filters drafts and sorts posts by newest publish date', () => {
        const posts = filterPublishedBlogPosts([
            blogPost({ publishedAt: '2026-01-01', slug: 'older' }),
            blogPost({
                draft: true,
                publishedAt: '2026-03-01',
                slug: 'draft'
            }),
            blogPost({ publishedAt: '2026-02-01', slug: 'newer' })
        ]);

        expect(posts.map(post => post.slug)).toEqual(['newer', 'older']);
    });

    it('builds canonical metadata and keywords for a post', () => {
        const post = blogPost();
        const metadata = createBlogPostMetadata(post);

        expect(metadata.title).toBe(post.title);
        expect(metadata.description).toBe(post.description);
        expect(metadata.alternates?.canonical).toBe(
            'https://xpenser.cleverbrush.com/blog/sample-post'
        );
        expect(metadata.keywords).toEqual([
            'sample keyword',
            'open-source expense tracker'
        ]);
    });

    it('builds blog JSON-LD and sitemap entries', async () => {
        const post = blogPost();
        const postJsonLd = createBlogPostJsonLd(post);
        const indexJsonLd = createBlogIndexJsonLd([post]);
        const sitemap = await getBlogPostSitemap();

        expect(postJsonLd).toEqual(
            expect.objectContaining({
                '@type': 'BlogPosting',
                headline: post.title,
                keywords: ['sample keyword', 'open-source expense tracker']
            })
        );
        expect(indexJsonLd).toEqual(
            expect.objectContaining({
                '@type': 'CollectionPage',
                mainEntity: [
                    expect.objectContaining({
                        headline: post.title
                    })
                ]
            })
        );
        expect(sitemap.map(entry => entry.url)).toContain(
            'https://xpenser.cleverbrush.com/blog/markdown-blog-workflow'
        );
    });

    it('formats dates and derives paths consistently', () => {
        const post = blogPost();

        expect(formatBlogDate(post.publishedAt)).toBe('June 27, 2026');
        expect(blogPostPath(post.slug)).toBe('/blog/sample-post');
        expect(getBlogPostKeywords(post)).toEqual([
            'sample keyword',
            'open-source expense tracker'
        ]);
    });
});

function blogPost(overrides: Partial<BlogPost> = {}): BlogPost {
    return {
        content: 'Sample content',
        description:
            'A sample blog post description with enough detail for metadata.',
        draft: false,
        keywords: ['open-source expense tracker'],
        publishedAt: '2026-06-27',
        slug: 'sample-post',
        targetKeyword: 'sample keyword',
        title: 'Sample post',
        updatedAt: '2026-06-27',
        ...overrides
    };
}
