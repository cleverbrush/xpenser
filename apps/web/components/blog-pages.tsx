import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CalendarDaysIcon,
    HomeIcon,
    TagIcon
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
    type BlogPost,
    blogPostPath,
    formatBlogDate,
    getBlogPostImage,
    getBlogPostKeywords
} from '@/lib/blog';
import { blogIndexPage } from '@/lib/public-site';
import { CtaPanel, PublicPageShell } from './landing-page';

export function BlogIndexPage({
    posts
}: {
    readonly posts: readonly BlogPost[];
}) {
    return (
        <PublicPageShell>
            <section className="border-b bg-muted/35">
                <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
                    <Badge className="mb-5 w-fit" variant="secondary">
                        Product updates
                    </Badge>
                    <div className="max-w-3xl">
                        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                            {blogIndexPage.h1}
                        </h1>
                        <p className="mt-5 text-lg leading-8 text-muted-foreground">
                            {blogIndexPage.description}
                        </p>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
                {posts.length === 0 ? (
                    <div className="rounded-lg border bg-muted/35 p-6">
                        <h2 className="text-xl font-semibold">
                            No published posts yet
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Published xpenser release notes and feature posts
                            will appear here after they merge.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {posts.map(post => (
                            <BlogPostCard key={post.slug} post={post} />
                        ))}
                    </div>
                )}
            </section>

            <CtaPanel />
        </PublicPageShell>
    );
}

export function BlogPostPage({
    children,
    post
}: {
    readonly children: ReactNode;
    readonly post: BlogPost;
}) {
    return (
        <PublicPageShell>
            <article>
                <header className="border-b bg-muted/35">
                    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
                        <BlogBreadcrumb current={post.title} />
                        <Badge className="mb-5 w-fit" variant="secondary">
                            {post.targetKeyword}
                        </Badge>
                        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                            {post.title}
                        </h1>
                        <p className="mt-5 text-lg leading-8 text-muted-foreground">
                            {post.description}
                        </p>
                        <BlogPostMeta post={post} />
                        {post.heroImage ? (
                            <BlogHeroImage post={post} variant="post" />
                        ) : null}
                    </div>
                </header>

                <div className="mx-auto max-w-3xl px-4 py-10 sm:py-12">
                    <div className="space-y-6 text-base leading-8 text-foreground">
                        {children}
                    </div>
                    <div className="mt-10 border-t pt-6">
                        <Button asChild variant="outline">
                            <Link href={blogIndexPage.path}>
                                <ArrowLeftIcon aria-hidden className="size-4" />
                                Back to blog
                            </Link>
                        </Button>
                    </div>
                </div>
            </article>
            <CtaPanel />
        </PublicPageShell>
    );
}

function BlogPostCard({ post }: { readonly post: BlogPost }) {
    return (
        <Card className="h-full overflow-hidden">
            {post.heroImage ? (
                <BlogHeroImage post={post} variant="card" />
            ) : null}
            <CardHeader>
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <CalendarDaysIcon aria-hidden className="size-3.5" />
                    {formatBlogDate(post.publishedAt)}
                </div>
                <CardTitle className="text-xl leading-snug">
                    <Link
                        className="outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        href={blogPostPath(post.slug)}
                    >
                        {post.title}
                    </Link>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                    {post.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {getBlogPostKeywords(post)
                        .slice(0, 3)
                        .map(keyword => (
                            <span
                                className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground"
                                key={keyword}
                            >
                                <TagIcon aria-hidden className="size-3" />
                                {keyword}
                            </span>
                        ))}
                </div>
                <Button asChild className="mt-5" size="sm" variant="outline">
                    <Link href={blogPostPath(post.slug)}>
                        Read post
                        <ArrowRightIcon aria-hidden className="size-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}

function BlogHeroImage({
    post,
    variant
}: {
    readonly post: BlogPost;
    readonly variant: 'card' | 'post';
}) {
    const image = getBlogPostImage(post);

    return (
        <div
            className={
                variant === 'card'
                    ? 'relative aspect-[16/9] border-b bg-muted'
                    : 'relative mt-8 aspect-[16/9] overflow-hidden rounded-lg border bg-background'
            }
        >
            <Image
                alt={image.alt}
                className="object-cover"
                fill
                sizes={
                    variant === 'card'
                        ? '(min-width: 768px) 50vw, 100vw'
                        : '(min-width: 768px) 768px, 100vw'
                }
                src={image.path}
            />
        </div>
    );
}

function BlogBreadcrumb({ current }: { readonly current: string }) {
    return (
        <nav aria-label="Breadcrumb" className="mb-5 text-sm">
            <ol className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <li>
                    <Link
                        className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
                        href="/"
                    >
                        <HomeIcon aria-hidden className="size-4" />
                        xpenser
                    </Link>
                </li>
                <li aria-hidden>/</li>
                <li>
                    <Link
                        className="font-medium text-foreground hover:text-primary"
                        href={blogIndexPage.path}
                    >
                        Blog
                    </Link>
                </li>
                <li aria-hidden>/</li>
                <li className="font-medium text-foreground">{current}</li>
            </ol>
        </nav>
    );
}

function BlogPostMeta({ post }: { readonly post: BlogPost }) {
    return (
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
                <CalendarDaysIcon aria-hidden className="size-4" />
                Published {formatBlogDate(post.publishedAt)}
            </span>
            {post.updatedAt && post.updatedAt !== post.publishedAt ? (
                <span>Updated {formatBlogDate(post.updatedAt)}</span>
            ) : null}
        </div>
    );
}
