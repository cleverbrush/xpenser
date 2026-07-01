import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@xpenser/ui';
import {
    ArrowRightIcon,
    CheckCircle2Icon,
    ExternalLinkIcon,
    HomeIcon,
    SearchIcon
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
    type AlternativeProduct,
    alternativeProducts,
    alternativesIndexPage
} from '@/lib/alternatives';
import { ProductPreview, PublicPageShell } from './landing-page';

const outboundRel = 'nofollow noopener noreferrer';

function AlternativeBreadcrumb({ current }: { readonly current?: string }) {
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
                {current ? (
                    <>
                        <li>
                            <Link
                                className="font-medium text-foreground hover:text-primary"
                                href={alternativesIndexPage.path}
                            >
                                Alternatives
                            </Link>
                        </li>
                        <li aria-hidden>/</li>
                        <li className="font-medium text-foreground">
                            {current}
                        </li>
                    </>
                ) : (
                    <li className="font-medium text-foreground">
                        Alternatives
                    </li>
                )}
            </ol>
        </nav>
    );
}

function KeywordChips({ keywords }: { readonly keywords: readonly string[] }) {
    return (
        <div className="flex flex-wrap gap-2">
            {keywords.map(keyword => (
                <span
                    className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    key={keyword}
                >
                    <SearchIcon aria-hidden className="size-3" />
                    {keyword}
                </span>
            ))}
        </div>
    );
}

function AlternativeCard({
    product
}: {
    readonly product: AlternativeProduct;
}) {
    return (
        <Card className="h-full">
            <CardHeader>
                <Badge className="mb-2 w-fit" variant="secondary">
                    {product.eyebrow}
                </Badge>
                <CardTitle className="text-xl leading-snug">
                    <Link
                        className="outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        href={product.path}
                    >
                        {product.h1}
                    </Link>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                    {product.description}
                </p>
                <div className="mt-4">
                    <KeywordChips keywords={product.keywords.slice(0, 3)} />
                </div>
                <Button asChild className="mt-5" size="sm" variant="outline">
                    <Link href={product.path}>
                        Compare
                        <ArrowRightIcon aria-hidden className="size-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}

function ValueCard({
    children,
    title
}: {
    readonly children: ReactNode;
    readonly title: string;
}) {
    return (
        <Card className="h-full">
            <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <CheckCircle2Icon aria-hidden className="size-5" />
                </div>
                <CardTitle className="text-base leading-snug">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                    {children}
                </p>
            </CardContent>
        </Card>
    );
}

export function AlternativesIndexPage() {
    return (
        <PublicPageShell nofollowOutboundLinks>
            <section className="border-b bg-muted/35">
                <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:py-16">
                    <div>
                        <AlternativeBreadcrumb />
                        <Badge className="mb-5 w-fit" variant="secondary">
                            Competitor alternatives
                        </Badge>
                        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                            {alternativesIndexPage.h1}
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                            {alternativesIndexPage.description}
                        </p>
                        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                            These pages compare xpenser against popular
                            budgeting apps, personal finance dashboards,
                            spreadsheet workflows, and open-source finance
                            managers for people searching competitor
                            alternatives.
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
                                <Link href="/open-source-expense-tracker">
                                    Open-source tracker
                                </Link>
                            </Button>
                        </div>
                    </div>
                    <ProductPreview />
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                <div className="mb-8 max-w-3xl">
                    <h2 className="text-2xl font-semibold">
                        Compare xpenser with personal finance competitors
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Each comparison focuses on product fit, ownership,
                        finance tracking, reporting, API access, MCP workflows,
                        and self-hosting so search visitors can quickly decide
                        whether xpenser matches their use case.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {alternativeProducts.map(product => (
                        <AlternativeCard key={product.slug} product={product} />
                    ))}
                </div>
            </section>

            <section className="border-t bg-muted/35">
                <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                    <div className="grid gap-3 md:grid-cols-3">
                        <ValueCard title="Open-source alternative research">
                            xpenser is a self-hostable MIT licensed finance
                            tracker, so alternatives pages can compare product
                            ownership and source access alongside everyday
                            tracking workflows.
                        </ValueCard>
                        <ValueCard title="Expense tracking comparison">
                            The core workflow covers income, expenses, refunds,
                            returns, vendors, categories, notes, tags, dates,
                            dashboards, and multi-currency records.
                        </ValueCard>
                        <ValueCard title="API and agent workflows">
                            API keys, OpenAPI docs, typed client access, MCP
                            tools, and Telegram workflows make xpenser useful
                            beyond a standard personal finance dashboard.
                        </ValueCard>
                    </div>
                </div>
            </section>

            <AlternativeCta />
        </PublicPageShell>
    );
}

function ComparisonTable({
    product
}: {
    readonly product: AlternativeProduct;
}) {
    return (
        <Table>
            <caption className="sr-only">
                Feature comparison of xpenser and {product.name}
            </caption>
            <TableHeader>
                <TableRow>
                    <TableHead>Comparison point</TableHead>
                    <TableHead>xpenser</TableHead>
                    <TableHead>{product.name}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {product.comparisonRows.map(row => (
                    <TableRow key={row.feature}>
                        <TableCell className="min-w-44 font-medium text-foreground">
                            {row.feature}
                        </TableCell>
                        <TableCell className="min-w-64 leading-6 text-muted-foreground">
                            {row.xpenser}
                        </TableCell>
                        <TableCell className="min-w-64 leading-6 text-muted-foreground">
                            {row.competitor}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function HighlightGrid({ product }: { readonly product: AlternativeProduct }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {product.highlights.map(item => (
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

function RelatedAlternatives({
    product
}: {
    readonly product: AlternativeProduct;
}) {
    const related = alternativeProducts
        .filter(item => item.slug !== product.slug)
        .slice(0, 4);

    return (
        <section className="border-t bg-muted/35">
            <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                <div className="mb-8 max-w-2xl">
                    <h2 className="text-2xl font-semibold">
                        Related xpenser alternatives
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Continue comparing xpenser with other budgeting apps,
                        personal finance dashboards, and open-source finance
                        managers.
                    </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    {related.map(item => (
                        <Card className="h-full" key={item.slug}>
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

function AlternativeCta() {
    return (
        <section className="border-t bg-background">
            <div className="mx-auto max-w-6xl px-4 py-10">
                <div className="flex flex-col gap-5 rounded-lg border bg-muted/35 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="max-w-xl">
                        <h2 className="text-2xl font-semibold">
                            Try xpenser or inspect the source
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Create a hosted account, review the open-source
                            expense tracker page, or compare the full
                            alternatives cluster before choosing a personal
                            finance workflow.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                        <Button asChild size="lg">
                            <Link href="/register">Create account</Link>
                        </Button>
                        <Button asChild size="lg" variant="outline">
                            <Link href="/open-source-expense-tracker">
                                Open-source tracker
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="ghost">
                            <Link href={alternativesIndexPage.path}>
                                All alternatives
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function AlternativeProductPage({
    product
}: {
    readonly product: AlternativeProduct;
}) {
    return (
        <PublicPageShell nofollowOutboundLinks>
            <section className="border-b bg-muted/35">
                <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:py-16">
                    <div>
                        <AlternativeBreadcrumb current={product.h1} />
                        <Badge className="mb-5 w-fit" variant="secondary">
                            {product.eyebrow}
                        </Badge>
                        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                            {product.h1}
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                            {product.description}
                        </p>
                        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                            {product.audience}
                        </p>
                        <div className="mt-6">
                            <KeywordChips keywords={product.keywords} />
                        </div>
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
                                    href={product.sourceUrl}
                                    rel={outboundRel}
                                    target="_blank"
                                >
                                    {product.sourceLabel}
                                    <ExternalLinkIcon
                                        aria-hidden
                                        className="size-3"
                                    />
                                </a>
                            </Button>
                        </div>
                        <div className="mt-6">
                            <HighlightGrid product={product} />
                        </div>
                    </div>
                    <ProductPreview />
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                <div className="grid gap-3 md:grid-cols-2">
                    <ValueCard title={`What ${product.name} is known for`}>
                        {product.competitorSummary}
                    </ValueCard>
                    <ValueCard title="Where xpenser fits">
                        {product.xpenserSummary}
                    </ValueCard>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 pb-14 sm:pb-16">
                <div className="mb-6 max-w-3xl">
                    <h2 className="text-2xl font-semibold">
                        xpenser vs {product.name}: feature comparison
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        This comparison is written for people searching for{' '}
                        {product.keywords.slice(0, 3).join(', ')} and deciding
                        whether an open-source finance tracker fits better than
                        a hosted competitor workflow.
                    </p>
                </div>
                <div className="rounded-lg border bg-card p-2 shadow-sm">
                    <ComparisonTable product={product} />
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 pb-14 sm:pb-16">
                <div className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
                    <h2 className="text-2xl font-semibold">
                        Frequently asked questions
                    </h2>
                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                        <div>
                            <h3 className="text-base font-semibold">
                                Is xpenser a {product.name} alternative?
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {product.xpenserSummary}
                            </p>
                        </div>
                        <div>
                            <h3 className="text-base font-semibold">
                                Can xpenser be self-hosted?
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Yes. xpenser is open source, MIT licensed, and
                                self-hostable from the public repository.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <RelatedAlternatives product={product} />
            <AlternativeCta />
        </PublicPageShell>
    );
}
