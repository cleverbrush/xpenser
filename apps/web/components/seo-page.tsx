import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import {
    ArrowRightIcon,
    CheckCircle2Icon,
    FileJsonIcon,
    GithubIcon,
    HomeIcon
} from 'lucide-react';
import Link from 'next/link';
import {
    apiDocsPage,
    type PublicMarketingPage,
    publicSeoPages
} from '@/lib/public-site';
import { CtaPanel, ProductPreview, PublicPageShell } from './landing-page';

function Breadcrumbs({ page }: { readonly page: PublicMarketingPage }) {
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
                <li className="font-medium text-foreground">{page.h1}</li>
            </ol>
        </nav>
    );
}

function ProofItems({ items }: { readonly items: readonly string[] }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {items.map(item => (
                <div
                    className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-foreground"
                    key={item}
                >
                    <CheckCircle2Icon
                        aria-hidden
                        className="size-4 shrink-0 text-primary"
                    />
                    <span className="leading-5">{item}</span>
                </div>
            ))}
        </div>
    );
}

function RelatedPages({ page }: { readonly page: PublicMarketingPage }) {
    const relatedPages = publicSeoPages.filter(item => item.path !== page.path);

    return (
        <section className="border-t bg-muted/35">
            <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                <div className="mb-8 max-w-2xl">
                    <h2 className="text-2xl font-semibold">
                        Related xpenser pages
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Compare the main product paths for self-hosting, expense
                        tracking, and API or MCP access.
                    </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    {relatedPages.map(item => (
                        <Card className="h-full" key={item.path}>
                            <CardHeader>
                                <CardTitle className="text-base leading-snug">
                                    <Link
                                        className="outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                                        href={item.path}
                                    >
                                        {item.h1}
                                    </Link>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    {item.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function SeoPage({ page }: { readonly page: PublicMarketingPage }) {
    return (
        <PublicPageShell>
            <section className="border-b bg-muted/35">
                <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:py-16">
                    <div>
                        <Breadcrumbs page={page} />
                        <Badge className="mb-5 w-fit" variant="secondary">
                            {page.eyebrow}
                        </Badge>
                        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                            {page.h1}
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                            {page.description}
                        </p>
                        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                            Create a hosted account for the public xpenser
                            instance, or use the source link to inspect and
                            self-host the same app.
                        </p>
                        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                            <Button asChild className="sm:flex-1" size="lg">
                                <Link href="/register">
                                    Create account
                                    <ArrowRightIcon
                                        aria-hidden
                                        className="size-4"
                                    />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                className="sm:flex-1"
                                size="lg"
                                variant="outline"
                            >
                                <a
                                    href="https://github.com/cleverbrush/xpenser"
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    <GithubIcon
                                        aria-hidden
                                        className="size-4"
                                    />
                                    View source
                                </a>
                            </Button>
                        </div>
                        {page.path === '/personal-finance-api-mcp' ? (
                            <Button
                                asChild
                                className="mt-3"
                                size="lg"
                                variant="outline"
                            >
                                <Link href={apiDocsPage.path}>
                                    <FileJsonIcon
                                        aria-hidden
                                        className="size-4"
                                    />
                                    Open API docs
                                </Link>
                            </Button>
                        ) : null}
                        <div className="mt-6">
                            <ProofItems items={page.proofItems} />
                        </div>
                    </div>
                    <ProductPreview />
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                <div className="grid gap-3 md:grid-cols-3">
                    {page.sections.map(section => (
                        <Card className="h-full" key={section.title}>
                            <CardHeader>
                                <CardTitle className="text-base leading-snug">
                                    {section.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    {section.body}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            <RelatedPages page={page} />
            <CtaPanel />
        </PublicPageShell>
    );
}
