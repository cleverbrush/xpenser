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
    BotIcon,
    CheckCircle2Icon,
    DatabaseIcon,
    ExternalLinkIcon,
    KeyRoundIcon,
    LayoutDashboardIcon,
    LineChartIcon,
    ListChecksIcon,
    LogInIcon,
    RadioTowerIcon,
    ReceiptTextIcon,
    ShieldCheckIcon,
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
            'Record income, expenses, refunds, and reversals with category, note, date, and currency context.',
        icon: ReceiptTextIcon,
        title: 'Transaction tracking'
    },
    {
        description:
            'Reports compare current activity with previous periods and previous-year baselines.',
        icon: LineChartIcon,
        title: 'Period reports'
    },
    {
        description:
            'Preferences cover default currency, favorite transaction currencies, time zone, API keys, and Telegram linking.',
        icon: ListChecksIcon,
        title: 'Personal setup'
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
            'Passport sign-in, API keys, and protected endpoint metadata demonstrate framework-level auth integration.',
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
    ['Transactions', 'Filtering, editing, reversals, multi-currency input'],
    ['Reports', 'Period comparison with charted historical context'],
    ['External API', 'Typed client, API keys, and read-only MCP endpoint']
] as const;

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
            className="pointer-events-none absolute inset-x-3 bottom-0 top-48 overflow-hidden sm:inset-x-auto sm:left-[44%] sm:right-6 sm:top-20 lg:left-[46%] lg:right-10"
            role="img"
        >
            <div className="mx-auto flex h-full max-w-xl items-end sm:items-center">
                <div className="w-full rounded-t-lg border bg-background/96 p-3 shadow-2xl sm:rounded-lg sm:p-4">
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
                                <div className="h-2.5 w-20 rounded bg-foreground/80" />
                                <div className="mt-1.5 h-2 w-28 rounded bg-muted-foreground/30" />
                            </div>
                        </div>
                        <div className="h-7 w-20 rounded-md bg-primary/90" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-md border p-3">
                            <div className="text-[10px] font-medium uppercase text-muted-foreground">
                                Income
                            </div>
                            <div className="mt-2 h-3 w-16 rounded bg-emerald-500" />
                            <div className="mt-3 h-1.5 w-full rounded bg-muted" />
                        </div>
                        <div className="rounded-md border p-3">
                            <div className="text-[10px] font-medium uppercase text-muted-foreground">
                                Expenses
                            </div>
                            <div className="mt-2 h-3 w-14 rounded bg-amber-500" />
                            <div className="mt-3 h-1.5 w-full rounded bg-muted" />
                        </div>
                        <div className="rounded-md border p-3">
                            <div className="text-[10px] font-medium uppercase text-muted-foreground">
                                Net
                            </div>
                            <div className="mt-2 h-3 w-12 rounded bg-sky-500" />
                            <div className="mt-3 h-1.5 w-full rounded bg-muted" />
                        </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                        <div className="rounded-md border p-3">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="h-3 w-24 rounded bg-foreground/80" />
                                <div className="h-2.5 w-14 rounded bg-muted-foreground/30" />
                            </div>
                            <div className="space-y-2">
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
                        <div className="rounded-md border p-3">
                            <div className="mb-3 h-3 w-20 rounded bg-foreground/80" />
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
                    <div className="mt-3 rounded-md border">
                        {capabilityRows.map(([label, detail]) => (
                            <div
                                className="grid grid-cols-[104px_1fr] gap-3 border-b px-3 py-2 text-xs last:border-b-0"
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

            <section className="relative min-h-[720px] overflow-hidden border-b bg-muted/40 sm:min-h-[680px]">
                <ProductPreview />
                <div className="relative z-10 mx-auto flex max-w-6xl flex-col px-4 pb-72 pt-14 sm:pb-24 sm:pt-20">
                    <Badge className="mb-5 w-fit" variant="secondary">
                        Cleverbrush Framework demonstrator
                    </Badge>
                    <div className="max-w-2xl">
                        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                            xpenser
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                            Personal income and expense tracking that initially
                            demonstrates what can be built with Cleverbrush
                            Framework: typed contracts, schema-driven forms,
                            observable services, and connected app workflows.
                        </p>
                    </div>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <Button asChild size="lg">
                            <Link href="/login">
                                Sign in
                                <ArrowRightIcon
                                    aria-hidden
                                    className="size-4"
                                />
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="outline">
                            <Link href="/register">Create account</Link>
                        </Button>
                        <Button asChild size="lg" variant="ghost">
                            <a
                                href="https://docs.cleverbrush.com"
                                rel="noreferrer"
                                target="_blank"
                            >
                                Cleverbrush docs
                                <ExternalLinkIcon
                                    aria-hidden
                                    className="size-4"
                                />
                            </a>
                        </Button>
                    </div>
                    <div className="mt-8 grid max-w-2xl gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                        {[
                            'Fast financial entry',
                            'Typed external API',
                            'Traceable production stack'
                        ].map(item => (
                            <div className="flex items-center gap-2" key={item}>
                                <CheckCircle2Icon
                                    aria-hidden
                                    className="size-4 text-primary"
                                />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                <div className="mb-8 max-w-2xl">
                    <h2 className="text-2xl font-semibold">
                        Useful finance workflows first
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        xpenser is a working app, not a static showcase. The
                        demo covers the product surfaces a user expects from a
                        finance tracker while keeping the implementation small
                        enough to inspect.
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {appFeatures.map(feature => (
                        <FeatureCard key={feature.title} {...feature} />
                    ))}
                </div>
            </section>

            <section className="border-y bg-muted/60">
                <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:py-16 lg:grid-cols-[0.8fr_1.2fr]">
                    <div>
                        <Badge className="mb-4 w-fit" variant="outline">
                            Framework surface
                        </Badge>
                        <h2 className="text-2xl font-semibold">
                            Built to show how Cleverbrush pieces fit together
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            The current version is initially a demonstrator of
                            possibilities: a single app path that exercises
                            Cleverbrush contracts, server handlers, generated
                            clients, schema-backed React forms, auth, logs, and
                            telemetry.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {frameworkFeatures.map(feature => (
                            <FeatureCard key={feature.title} {...feature} />
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto grid max-w-6xl gap-5 px-4 py-14 sm:py-16 lg:grid-cols-3">
                <div className="lg:col-span-1">
                    <h2 className="text-2xl font-semibold">
                        Connected entry points
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        The app exposes normal product UI and integration paths
                        for agents, services, and external clients.
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
                    {[
                        {
                            icon: KeyRoundIcon,
                            title: 'API keys',
                            text: 'Create durable keys for typed client access.'
                        },
                        {
                            icon: BotIcon,
                            title: 'MCP endpoint',
                            text: 'Read dashboard, category, and transaction data through tools.'
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

            <section className="border-t bg-foreground text-background">
                <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-xl">
                        <h2 className="text-2xl font-semibold">
                            Open the demonstrator
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-background/75">
                            Sign in to use the app, or review the framework docs
                            behind the contracts, forms, APIs, and telemetry.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button asChild size="lg" variant="secondary">
                            <Link href="/login">Sign in</Link>
                        </Button>
                        <Button
                            asChild
                            className="border-background/30 text-background hover:bg-background/10 hover:text-background"
                            size="lg"
                            variant="outline"
                        >
                            <a
                                href="https://docs.cleverbrush.com"
                                rel="noreferrer"
                                target="_blank"
                            >
                                Read Cleverbrush docs
                                <ExternalLinkIcon
                                    aria-hidden
                                    className="size-4"
                                />
                            </a>
                        </Button>
                    </div>
                </div>
            </section>
        </main>
    );
}
