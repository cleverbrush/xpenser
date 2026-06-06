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
    BookOpenIcon,
    BotIcon,
    BracesIcon,
    CheckCircle2Icon,
    CoinsIcon,
    DatabaseIcon,
    ExternalLinkIcon,
    GithubIcon,
    KeyRoundIcon,
    LayoutDashboardIcon,
    LineChartIcon,
    ListChecksIcon,
    LogInIcon,
    RadioTowerIcon,
    ReceiptTextIcon,
    SendIcon,
    ShieldCheckIcon,
    SmartphoneIcon,
    WorkflowIcon
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type Feature = {
    readonly description: string;
    readonly icon: Icon;
    readonly title: string;
};

const appFeatures: readonly Feature[] = [
    {
        description:
            'Daily, weekly, monthly, quarterly, and yearly summaries keep income, expenses, net totals, and trends visible.',
        icon: LayoutDashboardIcon,
        title: 'Dashboard summaries'
    },
    {
        description:
            'Record income, expenses, refunds, and returns with category, note, date, and currency context.',
        icon: ReceiptTextIcon,
        title: 'Transaction tracking'
    },
    {
        description:
            'Use multiple transaction currencies with automatic conversion to your default currency through Frankfurter rates.',
        icon: CoinsIcon,
        title: 'Multi-currency conversion'
    },
    {
        description:
            'Reports compare periods on demand, and configurable weekly and monthly email summaries surface OpenAI-generated spending and income insights.',
        icon: LineChartIcon,
        title: 'Reports and email summaries'
    },
    {
        description:
            'Preferences cover default currency, favorite transaction currencies, time zone, API keys, and Telegram bot linking.',
        icon: ListChecksIcon,
        title: 'Personal setup'
    },
    {
        description:
            'Responsive screens keep dashboard, transaction, and setup workflows usable on phones and desktops.',
        icon: SmartphoneIcon,
        title: 'Mobile-friendly interface'
    }
];

const frameworkFeatures: readonly Feature[] = [
    {
        description:
            'Shared schemas describe validation, OpenAPI output, React forms, and typed client contracts from one source.',
        icon: DatabaseIcon,
        title: 'Schema-first contracts'
    },
    {
        description:
            'The same contract powers the server handlers, generated client calls, auth metadata, and cache tags.',
        icon: WorkflowIcon,
        title: 'Typed full-stack flow'
    },
    {
        description:
            'Google sign-in, API keys, and protected endpoint metadata demonstrate framework-level auth integration.',
        icon: ShieldCheckIcon,
        title: 'Auth-aware APIs'
    },
    {
        description:
            'OpenTelemetry, structured logs, and typed environment parsing show how production behavior is wired in.',
        icon: RadioTowerIcon,
        title: 'Observable runtime'
    }
];

const capabilityRows = [
    ['Dashboard', 'Cash flow, net total, category split, trend marks'],
    [
        'Transactions',
        'Filtering, editing, nested categories, multi-currency input'
    ],
    ['Conversion', 'Automatic default-currency conversion via Frankfurter'],
    ['Reports', 'Period comparison with charted historical context'],
    [
        'Email summaries',
        'Configurable weekly and monthly spending and income insights'
    ],
    ['External API', 'Typed client, API keys, and MCP server']
] as const;

const heroProofs = [
    'Self-hosted finance app',
    'Multi-currency tracking',
    'MCP agent access',
    'Telegram bot integration',
    'Cleverbrush reference code',
    'MIT licensed'
] as const;

const resourceLinks = [
    {
        href: 'https://github.com/cleverbrush/xpenser',
        icon: GithubIcon,
        label: 'xpenser GitHub'
    },
    {
        href: 'https://github.com/cleverbrush/framework',
        icon: GithubIcon,
        label: 'Framework GitHub'
    },
    {
        href: 'https://docs.cleverbrush.com',
        icon: BookOpenIcon,
        label: 'Cleverbrush Docs'
    },
    {
        href: 'https://schema.cleverbrush.com',
        icon: BracesIcon,
        label: 'Schema Docs'
    }
] as const;

const heroResourceLinkClassName =
    'inline-flex h-9 items-center justify-start gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function FeatureCard({ description, icon: IconComponent, title }: Feature) {
    return (
        <Card className="h-full">
            <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <IconComponent aria-hidden className="size-5" />
                </div>
                <CardTitle className="text-base leading-snug">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}

function ProductPreview() {
    return (
        <div
            aria-label="xpenser dashboard preview"
            className="mx-auto w-full max-w-xl rounded-lg border bg-card p-2 shadow-xl sm:p-3 lg:max-w-none"
            role="img"
        >
            <div className="rounded-md border bg-background p-3 sm:p-4">
                <div className="mb-4 flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                        <Image
                            alt=""
                            aria-hidden
                            className="rounded-md"
                            height={28}
                            src="/icon.svg"
                            width={28}
                        />
                        <div>
                            <div className="text-sm font-semibold">
                                Monthly overview
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                                Income, expenses, and net trend
                            </div>
                        </div>
                    </div>
                    <div className="hidden h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground sm:flex">
                        Live data
                    </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md border bg-card p-3">
                        <div className="text-[10px] font-medium uppercase text-muted-foreground">
                            Income
                        </div>
                        <div className="mt-2 text-sm font-semibold">$4,280</div>
                        <div className="mt-3 h-1.5 w-full rounded bg-muted">
                            <div className="h-full w-4/5 rounded bg-primary" />
                        </div>
                    </div>
                    <div className="rounded-md border bg-card p-3">
                        <div className="text-[10px] font-medium uppercase text-muted-foreground">
                            Expenses
                        </div>
                        <div className="mt-2 text-sm font-semibold">$2,420</div>
                        <div className="mt-3 h-1.5 w-full rounded bg-muted">
                            <div className="h-full w-3/5 rounded bg-foreground/70" />
                        </div>
                    </div>
                    <div className="rounded-md border bg-card p-3">
                        <div className="text-[10px] font-medium uppercase text-muted-foreground">
                            Net
                        </div>
                        <div className="mt-2 text-sm font-semibold">$1,860</div>
                        <div className="mt-3 h-1.5 w-full rounded bg-muted">
                            <div className="h-full w-1/2 rounded bg-accent" />
                        </div>
                    </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-md border bg-card p-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-medium">
                                Category split
                            </div>
                            <div className="text-xs text-muted-foreground">
                                30 days
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            {[72, 54, 86, 48].map(width => (
                                <div
                                    className="grid grid-cols-[1fr_auto] items-center gap-4"
                                    key={width}
                                >
                                    <div className="h-2 rounded bg-muted" />
                                    <div
                                        className="h-2 rounded bg-primary/70"
                                        style={{ width }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-md border bg-card p-3">
                        <div className="mb-3 text-sm font-medium">
                            Spending trend
                        </div>
                        <div className="flex h-24 items-end gap-1.5">
                            {[30, 62, 42, 76, 50, 88, 58].map(height => (
                                <div
                                    className="flex-1 rounded-t bg-accent"
                                    key={height}
                                    style={{ height }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="mt-3 rounded-md border bg-card">
                    {capabilityRows.map(([label, detail]) => (
                        <div
                            className="grid grid-cols-[96px_1fr] gap-3 border-b px-3 py-2 text-xs last:border-b-0 sm:grid-cols-[112px_1fr]"
                            key={label}
                        >
                            <span className="font-medium">{label}</span>
                            <span className="truncate text-muted-foreground">
                                {detail}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ResourceButtons() {
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {resourceLinks.map(({ href, icon: IconComponent, label }) => (
                <a
                    className={heroResourceLinkClassName}
                    href={href}
                    key={href}
                    rel="noreferrer"
                    target="_blank"
                >
                    <IconComponent aria-hidden className="size-4 shrink-0" />
                    {label}
                    <ExternalLinkIcon
                        aria-hidden
                        className="ml-auto size-3 shrink-0"
                    />
                </a>
            ))}
        </div>
    );
}

function HeroProofs() {
    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {heroProofs.map(item => (
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

export function LandingPage() {
    return (
        <main className="min-h-dvh bg-background text-foreground">
            <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
                    <Link
                        className="flex items-center gap-2 font-semibold"
                        href="/"
                    >
                        <Image
                            alt=""
                            aria-hidden
                            className="rounded-md"
                            height={28}
                            src="/icon.svg"
                            width={28}
                        />
                        <span>xpenser</span>
                    </Link>
                    <nav className="flex items-center gap-2">
                        <div className="hidden items-center gap-1 md:flex">
                            {resourceLinks.map(({ href, label }) => (
                                <Button
                                    asChild
                                    key={href}
                                    size="sm"
                                    variant="ghost"
                                >
                                    <a
                                        href={href}
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        {label}
                                    </a>
                                </Button>
                            ))}
                        </div>
                        <Button
                            asChild
                            className="hidden sm:inline-flex"
                            size="sm"
                            variant="ghost"
                        >
                            <Link href="/register">Create account</Link>
                        </Button>
                        <Button asChild size="sm">
                            <Link href="/login">
                                <LogInIcon aria-hidden className="size-4" />
                                Sign in
                            </Link>
                        </Button>
                    </nav>
                </div>
            </header>

            <section className="border-b bg-muted/35">
                <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:py-16">
                    <div className="py-2 lg:py-6">
                        <Badge className="mb-5 w-fit" variant="secondary">
                            Open-source personal finance
                        </Badge>
                        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                            xpenser
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                            Track income, expenses, refunds, currencies,
                            vendors, and reports in a self-hosted app that keeps
                            the code open for inspection. Under the product
                            surface, xpenser shows how Cleverbrush Framework
                            connects typed contracts, schema-driven forms,
                            observable services, Telegram, API, and MCP
                            workflows.
                        </p>
                        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                            <Button asChild className="sm:flex-1" size="lg">
                                <Link href="/login">
                                    Sign in
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
                                <Link href="/register">Create account</Link>
                            </Button>
                        </div>
                        <div className="mt-5">
                            <ResourceButtons />
                        </div>
                        <div className="mt-6">
                            <HeroProofs />
                        </div>
                    </div>
                    <ProductPreview />
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                <div className="mb-8 max-w-2xl">
                    <h2 className="text-2xl font-semibold">
                        Personal finance workflows first
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        xpenser is a working app, not a static showcase. The
                        project covers the product surfaces a user expects from
                        a finance tracker while keeping the implementation
                        open-source and small enough to inspect or self-host,
                        including multiple currencies and Frankfurter-backed
                        automatic conversion.
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {appFeatures.map(feature => (
                        <FeatureCard key={feature.title} {...feature} />
                    ))}
                </div>
            </section>

            <section className="border-y bg-muted/60">
                <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:py-16 lg:grid-cols-[0.8fr_1.2fr]">
                    <div>
                        <Badge className="mb-4 w-fit" variant="outline">
                            Cleverbrush reference
                        </Badge>
                        <h2 className="text-2xl font-semibold">
                            Learn Cleverbrush from a working app
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            The codebase exercises Cleverbrush contracts, server
                            handlers, generated clients, schema-backed React
                            forms, auth, Telegram bot integration, an MCP
                            server, logs, telemetry, and deployment-ready
                            configuration for self-hosting.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {frameworkFeatures.map(feature => (
                            <FeatureCard key={feature.title} {...feature} />
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto grid max-w-6xl gap-5 px-4 py-14 sm:py-16 lg:grid-cols-[0.75fr_1.25fr]">
                <div className="lg:col-span-1">
                    <h2 className="text-2xl font-semibold">
                        Connected entry points
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        The app exposes normal product UI and integration paths
                        for agents, services, and external clients.
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        {
                            icon: KeyRoundIcon,
                            title: 'API keys',
                            text: 'Create durable keys for typed client access.'
                        },
                        {
                            icon: BotIcon,
                            title: 'MCP server',
                            text: 'Expose dashboard, category, and transaction data through tool calls.'
                        },
                        {
                            icon: SendIcon,
                            title: 'Telegram bot',
                            text: 'Link Telegram and use bot-driven finance workflows alongside the web UI.'
                        },
                        {
                            icon: RadioTowerIcon,
                            title: 'Telemetry',
                            text: 'Trace web, API, and integration paths through SigNoz.'
                        }
                    ].map(({ icon: IconComponent, text, title }) => (
                        <Card className="h-full" key={title}>
                            <CardHeader>
                                <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-accent/20 text-foreground">
                                    <IconComponent
                                        aria-hidden
                                        className="size-5"
                                    />
                                </div>
                                <CardTitle className="text-base">
                                    {title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    {text}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            <section className="border-t bg-background">
                <div className="mx-auto max-w-6xl px-4 py-10">
                    <div className="flex flex-col gap-5 rounded-lg border bg-muted/35 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="max-w-xl">
                            <h2 className="text-2xl font-semibold">
                                Use it, self-host it, or study the source
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Sign in to use the hosted app, review the source
                                on GitHub, or follow the Cleverbrush docs behind
                                the contracts, forms, APIs, and telemetry.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button asChild size="lg">
                                <Link href="/login">Sign in</Link>
                            </Button>
                            <Button asChild size="lg" variant="outline">
                                <Link href="/register">Create account</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="border-t bg-background">
                <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Image
                            alt=""
                            aria-hidden
                            className="rounded-md"
                            height={28}
                            src="/icon.svg"
                            width={28}
                        />
                        <div>
                            <div className="font-semibold text-foreground">
                                xpenser
                            </div>
                            <p>
                                Open-source personal finance built with
                                Cleverbrush Framework.
                            </p>
                        </div>
                    </div>
                    <nav className="flex flex-wrap gap-3">
                        {resourceLinks.map(({ href, label }) => (
                            <a
                                className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary"
                                href={href}
                                key={href}
                                rel="noreferrer"
                                target="_blank"
                            >
                                {label}
                                <ExternalLinkIcon
                                    aria-hidden
                                    className="size-3"
                                />
                            </a>
                        ))}
                    </nav>
                </div>
            </footer>
        </main>
    );
}
