/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BlogPost } from '@/lib/blog';
import { BlogIndexPage, BlogPostPage } from './blog-pages';

describe('blog pages', () => {
    it('renders the blog index with post links', () => {
        render(<BlogIndexPage posts={[blogPost()]} />);

        expect(
            screen.getByRole('heading', { level: 1, name: 'xpenser blog' })
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Sample blog post' })
        ).toHaveProperty('href', 'http://localhost:3000/blog/sample-blog-post');
        expect(screen.getByText('sample keyword')).toBeTruthy();
    });

    it('renders a blog post shell with metadata and breadcrumbs', () => {
        render(
            <BlogPostPage post={blogPost()}>
                <p>Rendered MDX body</p>
            </BlogPostPage>
        );

        expect(
            screen.getByRole('heading', { level: 1, name: 'Sample blog post' })
        ).toBeTruthy();
        expect(screen.getByLabelText('Breadcrumb')).toBeTruthy();
        expect(screen.getByText('Published June 27, 2026')).toBeTruthy();
        expect(screen.getByText('Rendered MDX body')).toBeTruthy();
        expect(
            screen.getByRole('link', { name: /Back to blog/i })
        ).toHaveProperty('href', 'http://localhost:3000/blog');
    });
});

function blogPost(): BlogPost {
    return {
        content: '# Sample',
        description:
            'A sample blog post description for the blog component tests.',
        draft: false,
        keywords: ['open-source expense tracker'],
        publishedAt: '2026-06-27',
        slug: 'sample-blog-post',
        targetKeyword: 'sample keyword',
        title: 'Sample blog post',
        updatedAt: '2026-06-27'
    };
}
