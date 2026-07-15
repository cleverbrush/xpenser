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
    Code2Icon,
    CoinsIcon,
    DatabaseIcon,
    ExternalLinkIcon,
    FileJsonIcon,
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
    UserPlusIcon,
    WorkflowIcon
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { alternativesIndexPage } from '@/lib/alternatives';
import { webConfig } from '@/lib/config';
import {
    apiDocsPage,
    apiSettingsScreenshot,
    appScreenshot,
    blogIndexPage,
    getPublicMarketingPage,
    mcpEndpointPath,
    openApiSpecPath,
    publicMarketingPages,
    publicSeoPages,
    publicUtilityPages,
    transactionsScreenshot
} from '@/lib/public-site';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type Feature = {
    readonly description: string;
    readonly icon: Icon;
    readonly title: string;
};

type ScreenshotAsset = {
    readonly alt: string;
    readonly height: number;
    readonly src: string;
    readonly width: number;
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
            'Use multiple transaction currencies with automatic conversion to each budget default currency through Frankfurter rates.',
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
            'Budget settings cover default and favorite transaction currencies, while preferences cover time zone, API keys, and Telegram bot linking.',
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

const huzzlerBadge = {
    alt: 'Huzzler Embed Badge',
    height: 55,
    href: 'https://huzzler.so/products/muk1OItiEN/xpenser?utm_source=huzzler_product_website&utm_medium=badge&utm_campaign=free_listing',
    src: 'https://huzzler.so/assets/images/embeddable-badges/featured.png',
    width: 159
} as const;

const tinyStartupsBadge = {
    href: 'https://www.tinystartups.com/startup/xpenser'
} as const;

const easyDoFollowBadge = {
    alt: 'Featured on EasyDoFollow',
    darkSrc: 'http://easydofollow.dev/badge/easydofollow-badge-dark.svg',
    height: 56,
    href: 'http://easydofollow.dev/finance/xpenser',
    lightSrc: 'http://easydofollow.dev/badge/easydofollow-badge-light.svg',
    width: 188
} as const;

const scrollLaunchBadge = {
    alt: 'Featured on ScrollLaunch',
    height: 48,
    href: 'https://www.scrolllaunch.com/products/xpenser?utm_source=badge&utm_medium=embed&utm_campaign=xpenser&ref=scrolllaunch',
    src: 'https://www.scrolllaunch.com/api/badge/xpenser',
    width: 220
} as const;

const auraPlusPlusBadge = {
    alt: 'Featured on Aura++',
    darkSrc: 'https://auraplusplus.com/images/badges/featured-on-dark.svg',
    height: 58,
    href: 'https://auraplusplus.com/projects/xpenser-self-hosted-personal-finance-tracker',
    lightSrc: 'https://auraplusplus.com/images/badges/featured-on-light.svg',
    width: 265
} as const;

const toolfioBadge = {
    alt: 'Featured on Toolfio',
    darkSrc: 'https://toolfio.com/toolfio-dark-badge.png',
    height: 54,
    href: 'https://toolfio.com',
    lightSrc: 'https://toolfio.com/toolfio-light-badge.png',
    width: 200
} as const;

const earlyHuntBadge = {
    alt: 'Featured on EarlyHunt',
    darkSrc: 'https://earlyhunt.com/badges/earlyhunt-badge-dark.svg',
    height: 58,
    href: 'https://earlyhunt.com/project/xpenser',
    lightSrc: 'https://earlyhunt.com/badges/earlyhunt-badge-light.svg',
    width: 265
} as const;

const dangBadge = {
    alt: 'Verified on DANG!',
    darkSrc: 'https://assets.dang.ai/badges/dang-verified-dark.png',
    height: 94,
    href: 'https://dang.ai',
    lightSrc: 'https://assets.dang.ai/badges/dang-verified-light.png',
    width: 260
} as const;

const twelveToolsBadge = {
    alt: 'Featured on Twelve Tools',
    darkSrc: 'https://twelve.tools/badge0-dark.svg',
    height: 54,
    href: 'https://twelve.tools',
    lightSrc: 'https://twelve.tools/badge0-white.svg',
    width: 200
} as const;

const wiredBusinessBadge = {
    alt: 'Featured on Wired Business',
    darkSrc: 'https://wired.business/badge0-dark.svg',
    height: 54,
    href: 'https://wired.business',
    lightSrc: 'https://wired.business/badge0-white.svg',
    width: 200
} as const;

const openHuntsBadge = {
    alt: 'OpenHunts Club Member',
    height: 105,
    href: 'https://openhunts.com',
    src: 'https://cdn.openhunts.com/badges/club.webp',
    title: 'OpenHunts Club',
    width: 486
} as const;

const apiCurlExample = `curl ${openApiSpecPath}
curl ${mcpEndpointPath} \\
  -H "Authorization: Bearer \${XPENSER_API_KEY}"`;

const typedClientExample = `const client = createXpenserClient({
  baseUrl: process.env.XPENSER_API_BASE_URL,
  getToken: () => process.env.XPENSER_API_KEY
});`;

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

export function ProductPreview({
    className = ''
}: {
    readonly className?: string;
}) {
    return (
        <figure
            className={`mx-auto w-full max-w-xl lg:max-w-none ${className}`}
        >
            <div className="rounded-lg border bg-card p-2 shadow-xl sm:p-3">
                <Image
                    alt={appScreenshot.alt}
                    className="aspect-[1.04] w-full rounded-md border object-cover object-top sm:aspect-[1.18] lg:aspect-[1.06]"
                    height={appScreenshot.height}
                    priority
                    sizes="(min-width: 1024px) 560px, 100vw"
                    src={appScreenshot.src}
                    width={appScreenshot.width}
                />
            </div>
        </figure>
    );
}

function ScreenshotPanel({
    description,
    image,
    title
}: {
    readonly description: string;
    readonly image: ScreenshotAsset;
    readonly title: string;
}) {
    return (
        <figure className="min-w-0">
            <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
                <Image
                    alt={image.alt}
                    className="aspect-[1.24] w-full object-cover object-top"
                    height={image.height}
                    sizes="(min-width: 1024px) 520px, 100vw"
                    src={image.src}
                    width={image.width}
                />
            </div>
            <figcaption className="mt-3">
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
            </figcaption>
        </figure>
    );
}

function CodeSample({
    children,
    label
}: {
    readonly children: string;
    readonly label: string;
}) {
    return (
        <div className="min-w-0 max-w-full overflow-hidden rounded-lg border bg-slate-950 text-slate-50 shadow-sm dark:bg-slate-900">
            <div className="border-b border-white/10 px-4 py-2 text-xs font-medium uppercase tracking-normal text-slate-300">
                {label}
            </div>
            <pre className="max-w-full overflow-x-auto p-4 text-sm leading-6">
                <code>{children}</code>
            </pre>
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

function ProofGrid({ items }: { readonly items: readonly string[] }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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

function InternalSeoLinks() {
    const pages = [...publicSeoPages, blogIndexPage] as const;

    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {pages.map(page => (
                <Card className="h-full" key={page.path}>
                    <CardHeader>
                        <CardTitle className="text-base leading-snug">
                            <Link
                                className="outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                                href={page.path}
                            >
                                {page.h1}
                            </Link>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm leading-6 text-muted-foreground">
                            {page.description}
                        </p>
                        <Button
                            asChild
                            className="mt-4"
                            size="sm"
                            variant="outline"
                        >
                            <Link href={page.path}>
                                Explore
                                <ArrowRightIcon
                                    aria-hidden
                                    className="size-4"
                                />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export function PublicSiteHeader() {
    return (
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
                    <div className="hidden items-center gap-1 lg:flex">
                        {publicMarketingPages.map(({ navLabel, path }) => (
                            <Button
                                asChild
                                key={path}
                                size="sm"
                                variant="ghost"
                            >
                                <Link href={path}>{navLabel}</Link>
                            </Button>
                        ))}
                        {publicUtilityPages.map(({ navLabel, path }) => (
                            <Button
                                asChild
                                key={path}
                                size="sm"
                                variant="ghost"
                            >
                                <Link href={path}>{navLabel}</Link>
                            </Button>
                        ))}
                    </div>
                    <Button
                        asChild
                        className="hidden sm:inline-flex"
                        size="sm"
                        variant="ghost"
                    >
                        <Link href="/login">Sign in</Link>
                    </Button>
                    <Button
                        asChild
                        className="sm:hidden"
                        size="icon-sm"
                        variant="ghost"
                    >
                        <Link aria-label="Sign in" href="/login">
                            <LogInIcon aria-hidden className="size-4" />
                        </Link>
                    </Button>
                    <Button asChild size="sm">
                        <Link href="/register">
                            <UserPlusIcon aria-hidden className="size-4" />
                            Create account
                        </Link>
                    </Button>
                </nav>
            </div>
        </header>
    );
}

function HuzzlerBadge() {
    return (
        <a
            className="block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={huzzlerBadge.href}
            rel="noopener noreferrer"
            target="_blank"
        >
            {/* biome-ignore lint/performance/noImgElement: Huzzler provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={huzzlerBadge.alt}
                height={huzzlerBadge.height}
                src={huzzlerBadge.src}
                width={huzzlerBadge.width}
            />
        </a>
    );
}

function TinyStartupsBadge() {
    return (
        <a
            aria-label="Launched on Tiny Startups"
            className="inline-flex w-fit items-center gap-3.5 rounded-[14px] border-2 border-transparent bg-[linear-gradient(#fff,#fff)_padding-box,linear-gradient(90deg,#3525E6,#D81FE0,#22B8F0)_border-box] py-3.5 pl-[18px] pr-[22px] font-sans text-[#0E0B1F] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[linear-gradient(#0E0B1F,#0E0B1F)_padding-box,linear-gradient(90deg,#3525E6,#D81FE0,#22B8F0)_border-box] dark:text-white"
            href={tinyStartupsBadge.href}
            rel="noopener noreferrer"
            target="_blank"
        >
            <svg
                aria-hidden
                className="size-14 shrink-0"
                focusable="false"
                viewBox="0 0 100 100"
            >
                <title>Tiny Startups badge mark</title>
                <defs>
                    <linearGradient
                        id="tiny-startups-gradient"
                        x1=".1"
                        x2=".9"
                        y1="0"
                        y2="1"
                    >
                        <stop offset="0%" stopColor="#3525E6" />
                        <stop offset="55%" stopColor="#D81FE0" />
                        <stop offset="100%" stopColor="#22B8F0" />
                    </linearGradient>
                </defs>
                <path
                    d="M50 6C52 32 68 48 94 50C68 52 52 68 50 94C48 68 32 52 6 50C32 48 48 32 50 6Z"
                    fill="url(#tiny-startups-gradient)"
                />
            </svg>
            <span className="flex flex-col leading-[1.15]">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-normal text-[#6A6585] dark:text-white/55">
                    Launched on
                </span>
                <span className="text-[22px] font-extrabold tracking-normal text-inherit dark:text-white">
                    Tiny Startups
                </span>
                <span className="mt-1 text-[11px] text-[#6A6585] dark:text-white/55">
                    tinystartups.com
                </span>
            </span>
        </a>
    );
}

function EasyDoFollowBadge() {
    return (
        <a
            aria-label={easyDoFollowBadge.alt}
            className="block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={easyDoFollowBadge.href}
            rel="noopener noreferrer"
            target="_blank"
        >
            {/* biome-ignore lint/performance/noImgElement: EasyDoFollow provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={easyDoFollowBadge.alt}
                className="block dark:hidden"
                height={easyDoFollowBadge.height}
                src={easyDoFollowBadge.lightSrc}
                width={easyDoFollowBadge.width}
            />
            {/* biome-ignore lint/performance/noImgElement: EasyDoFollow provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={easyDoFollowBadge.alt}
                className="hidden dark:block"
                height={easyDoFollowBadge.height}
                src={easyDoFollowBadge.darkSrc}
                width={easyDoFollowBadge.width}
            />
        </a>
    );
}

function ScrollLaunchBadge() {
    return (
        <a
            className="block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={scrollLaunchBadge.href}
            rel="noopener noreferrer"
            target="_blank"
        >
            {/* biome-ignore lint/performance/noImgElement: ScrollLaunch provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={scrollLaunchBadge.alt}
                height={scrollLaunchBadge.height}
                loading="lazy"
                src={scrollLaunchBadge.src}
                width={scrollLaunchBadge.width}
            />
        </a>
    );
}

function AuraPlusPlusBadge() {
    return (
        <a
            aria-label={auraPlusPlusBadge.alt}
            className="block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={auraPlusPlusBadge.href}
            rel="noopener noreferrer"
            target="_blank"
        >
            {/* biome-ignore lint/performance/noImgElement: Aura++ provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={auraPlusPlusBadge.alt}
                className="block dark:hidden"
                height={auraPlusPlusBadge.height}
                src={auraPlusPlusBadge.lightSrc}
                width={auraPlusPlusBadge.width}
            />
            {/* biome-ignore lint/performance/noImgElement: Aura++ provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={auraPlusPlusBadge.alt}
                className="hidden dark:block"
                height={auraPlusPlusBadge.height}
                src={auraPlusPlusBadge.darkSrc}
                width={auraPlusPlusBadge.width}
            />
        </a>
    );
}

function ToolfioBadge() {
    return (
        <a
            aria-label={toolfioBadge.alt}
            className="block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={toolfioBadge.href}
            rel="dofollow noopener noreferrer"
            target="_blank"
        >
            {/* biome-ignore lint/performance/noImgElement: Toolfio provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={toolfioBadge.alt}
                className="block dark:hidden"
                height={toolfioBadge.height}
                src={toolfioBadge.lightSrc}
                width={toolfioBadge.width}
            />
            {/* biome-ignore lint/performance/noImgElement: Toolfio provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={toolfioBadge.alt}
                className="hidden dark:block"
                height={toolfioBadge.height}
                src={toolfioBadge.darkSrc}
                width={toolfioBadge.width}
            />
        </a>
    );
}

function EarlyHuntBadge() {
    return (
        <a
            aria-label={earlyHuntBadge.alt}
            className="block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={earlyHuntBadge.href}
            rel="noopener noreferrer"
            target="_blank"
        >
            {/* biome-ignore lint/performance/noImgElement: EarlyHunt provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={earlyHuntBadge.alt}
                className="block dark:hidden"
                height={earlyHuntBadge.height}
                src={earlyHuntBadge.lightSrc}
                width={earlyHuntBadge.width}
            />
            {/* biome-ignore lint/performance/noImgElement: EarlyHunt provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={earlyHuntBadge.alt}
                className="hidden dark:block"
                height={earlyHuntBadge.height}
                src={earlyHuntBadge.darkSrc}
                width={earlyHuntBadge.width}
            />
        </a>
    );
}

function DangBadge() {
    return (
        <a
            aria-label={dangBadge.alt}
            className="block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={dangBadge.href}
            rel="dofollow noopener noreferrer"
            target="_blank"
        >
            {/* biome-ignore lint/performance/noImgElement: DANG provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={dangBadge.alt}
                className="block h-auto max-w-full dark:hidden"
                height={dangBadge.height}
                src={dangBadge.lightSrc}
                width={dangBadge.width}
            />
            {/* biome-ignore lint/performance/noImgElement: DANG provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={dangBadge.alt}
                className="hidden h-auto max-w-full dark:block"
                height={dangBadge.height}
                src={dangBadge.darkSrc}
                width={dangBadge.width}
            />
        </a>
    );
}

function TwelveToolsBadge() {
    return (
        <a
            aria-label={twelveToolsBadge.alt}
            className="block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={twelveToolsBadge.href}
            rel="noopener noreferrer"
            target="_blank"
        >
            {/* biome-ignore lint/performance/noImgElement: Twelve Tools provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={twelveToolsBadge.alt}
                className="block dark:hidden"
                height={twelveToolsBadge.height}
                src={twelveToolsBadge.lightSrc}
                width={twelveToolsBadge.width}
            />
            {/* biome-ignore lint/performance/noImgElement: Twelve Tools provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={twelveToolsBadge.alt}
                className="hidden dark:block"
                height={twelveToolsBadge.height}
                src={twelveToolsBadge.darkSrc}
                width={twelveToolsBadge.width}
            />
        </a>
    );
}

function WiredBusinessBadge() {
    return (
        <a
            aria-label={wiredBusinessBadge.alt}
            className="block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={wiredBusinessBadge.href}
            rel="noopener noreferrer"
            target="_blank"
        >
            {/* biome-ignore lint/performance/noImgElement: Wired Business provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={wiredBusinessBadge.alt}
                className="block dark:hidden"
                height={wiredBusinessBadge.height}
                src={wiredBusinessBadge.lightSrc}
                width={wiredBusinessBadge.width}
            />
            {/* biome-ignore lint/performance/noImgElement: Wired Business provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={wiredBusinessBadge.alt}
                className="hidden dark:block"
                height={wiredBusinessBadge.height}
                src={wiredBusinessBadge.darkSrc}
                width={wiredBusinessBadge.width}
            />
        </a>
    );
}

function OpenHuntsBadge() {
    return (
        <a
            className="block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={openHuntsBadge.href}
            rel="noopener noreferrer"
            target="_blank"
            title={openHuntsBadge.title}
        >
            {/* biome-ignore lint/performance/noImgElement: OpenHunts provides this hosted badge snippet, and next/image would need remote config for a tiny footer badge. */}
            <img
                alt={openHuntsBadge.alt}
                height={openHuntsBadge.height}
                src={openHuntsBadge.src}
                style={{ height: 'auto', width: '195px' }}
                width={openHuntsBadge.width}
            />
        </a>
    );
}

function FooterBadges() {
    return (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <HuzzlerBadge />
            <TinyStartupsBadge />
            <EasyDoFollowBadge />
            <ScrollLaunchBadge />
            <AuraPlusPlusBadge />
            <ToolfioBadge />
            <EarlyHuntBadge />
            <DangBadge />
            <TwelveToolsBadge />
            <WiredBusinessBadge />
            <OpenHuntsBadge />
        </div>
    );
}

export function PublicSiteFooter({
    footerSupplement,
    nofollowOutboundLinks = false
}: {
    readonly footerSupplement?: ReactNode;
    readonly nofollowOutboundLinks?: boolean;
} = {}) {
    const resourceLinkRel = nofollowOutboundLinks
        ? 'nofollow noopener noreferrer'
        : 'noreferrer';

    return (
        <footer className="border-t bg-background">
            <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
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
                            Self-hostable personal finance built with
                            Cleverbrush Framework.
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-4 lg:items-end">
                    <nav className="flex flex-wrap gap-3">
                        {publicMarketingPages.map(({ navLabel, path }) => (
                            <Link
                                className="font-medium text-foreground transition-colors hover:text-primary"
                                href={path}
                                key={path}
                            >
                                {navLabel}
                            </Link>
                        ))}
                        {publicUtilityPages.map(({ navLabel, path }) => (
                            <Link
                                className="font-medium text-foreground transition-colors hover:text-primary"
                                href={path}
                                key={path}
                            >
                                {navLabel}
                            </Link>
                        ))}
                        <Link
                            className="font-medium text-foreground transition-colors hover:text-primary"
                            href={alternativesIndexPage.path}
                        >
                            {alternativesIndexPage.navLabel}
                        </Link>
                        <a
                            className="font-medium text-foreground transition-colors hover:text-primary"
                            href="/llms.txt"
                        >
                            llms.txt
                        </a>
                        {resourceLinks.map(({ href, label }) => (
                            <a
                                className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary"
                                href={href}
                                key={href}
                                rel={resourceLinkRel}
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
                    {footerSupplement ? (
                        <div className="flex justify-start lg:justify-end">
                            {footerSupplement}
                        </div>
                    ) : null}
                </div>
            </div>
        </footer>
    );
}

export function PublicPageShell({
    children,
    footerSupplement,
    nofollowOutboundLinks = false
}: {
    readonly children: ReactNode;
    readonly footerSupplement?: ReactNode;
    readonly nofollowOutboundLinks?: boolean;
}) {
    if (webConfig.singleUser?.enabled) {
        return (
            <div className="min-h-dvh bg-background text-foreground">
                <main id="main-content" tabIndex={-1}>
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <a
                className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow-lg ring-2 ring-ring focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
                href="#main-content"
            >
                Skip to main content
            </a>
            <PublicSiteHeader />
            <main id="main-content" tabIndex={-1}>
                {children}
            </main>
            <PublicSiteFooter
                footerSupplement={footerSupplement}
                nofollowOutboundLinks={nofollowOutboundLinks}
            />
        </div>
    );
}

export function CtaPanel() {
    return (
        <section className="border-t bg-background">
            <div className="mx-auto max-w-6xl px-4 py-10">
                <div className="flex flex-col gap-5 rounded-lg border bg-muted/35 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="max-w-xl">
                        <h2 className="text-2xl font-semibold">
                            Start hosted, then self-host when ready
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Create a hosted xpenser account for the public
                            instance, or review the MIT licensed source and run
                            your own deployment from Docker Compose.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                        <Button asChild size="lg">
                            <Link href="/register">Create account</Link>
                        </Button>
                        <Button asChild size="lg" variant="outline">
                            <a
                                href="https://github.com/cleverbrush/xpenser"
                                rel="noreferrer"
                                target="_blank"
                            >
                                <GithubIcon aria-hidden className="size-4" />
                                View source
                            </a>
                        </Button>
                        <Button asChild size="lg" variant="ghost">
                            <Link href="/login">Sign in</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function LandingPage() {
    const homePage = getPublicMarketingPage('/');

    return (
        <PublicPageShell footerSupplement={<FooterBadges />}>
            <section className="border-b bg-muted/35">
                <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:py-16">
                    <div className="py-2 lg:py-6">
                        <Badge className="mb-5 w-fit" variant="secondary">
                            {homePage.eyebrow}
                        </Badge>
                        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                            {homePage.h1}
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                            Track and analyze income and expenses with
                            dashboards, categories, vendors, reports, and
                            OpenAPI/MCP access in a self-hostable app with
                            source you can inspect.
                        </p>
                        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                            Accounts are for xpenser.cleverbrush.com;
                            self-hosted deployments run from the same MIT
                            licensed source.
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
                                <Link href="/login">
                                    Sign in
                                    <LogInIcon aria-hidden className="size-4" />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                className="sm:flex-1"
                                size="lg"
                                variant="ghost"
                            >
                                <Link href={apiDocsPage.path}>
                                    API docs
                                    <FileJsonIcon
                                        aria-hidden
                                        className="size-4"
                                    />
                                </Link>
                            </Button>
                        </div>
                        <div className="mt-5">
                            <ResourceButtons />
                        </div>
                        <div className="mt-6">
                            <ProofGrid items={homePage.proofItems} />
                        </div>
                    </div>
                    <ProductPreview />
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                <div className="mb-8 max-w-2xl">
                    <h2 className="text-2xl font-semibold">
                        Product-led paths for finance tracking
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Start with the angle that fits your evaluation:
                        self-hosting, open-source expense tracking, API and MCP
                        access, or product updates from the blog.
                    </p>
                </div>
                <InternalSeoLinks />
            </section>

            <section className="border-y bg-muted/35">
                <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                    <div className="mb-8 max-w-2xl">
                        <h2 className="text-2xl font-semibold">
                            Real screens, not a placeholder finance app
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            The public page now shows the transaction browser,
                            API key, and MCP setup surfaces directly, so users
                            can evaluate the product and integration workflow
                            before creating an account.
                        </p>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <ScreenshotPanel
                            description="Searchable transaction history shows categories, vendors, effects, amounts, and dates in the same data model exposed by the API."
                            image={transactionsScreenshot}
                            title="Transactions stay inspectable"
                        />
                        <ScreenshotPanel
                            description="Preferences include API keys, MCP OAuth setup, bearer-token fallback instructions, Telegram linking, and email report settings."
                            image={apiSettingsScreenshot}
                            title="Integrations live in the product"
                        />
                    </div>
                </div>
            </section>

            <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:py-16 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start">
                <div className="min-w-0">
                    <Badge className="mb-4 w-fit" variant="outline">
                        OpenAPI and MCP
                    </Badge>
                    <h2 className="text-2xl font-semibold">
                        API access is a product surface
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        xpenser already generates OpenAPI from the same
                        Cleverbrush contracts used by the server and typed
                        client. The public site should expose that reference
                        directly and point agent users to the MCP endpoint.
                    </p>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <Button asChild variant="outline">
                            <Link href={apiDocsPage.path}>
                                <FileJsonIcon aria-hidden className="size-4" />
                                API docs
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <a href={openApiSpecPath}>
                                <Code2Icon aria-hidden className="size-4" />
                                OpenAPI JSON
                            </a>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/personal-finance-api-mcp">
                                <BotIcon aria-hidden className="size-4" />
                                API and MCP guide
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <a
                                href="https://github.com/cleverbrush/xpenser"
                                rel="noreferrer"
                                target="_blank"
                            >
                                <GithubIcon aria-hidden className="size-4" />
                                Self-host source
                                <ExternalLinkIcon
                                    aria-hidden
                                    className="size-3"
                                />
                            </a>
                        </Button>
                    </div>
                </div>
                <div className="grid min-w-0 gap-4">
                    <CodeSample label="Generated API reference">
                        {apiCurlExample}
                    </CodeSample>
                    <CodeSample label="Typed client access">
                        {typedClientExample}
                    </CodeSample>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
                <div className="mb-8 max-w-2xl">
                    <h2 className="text-2xl font-semibold">
                        Personal finance workflows first
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        xpenser is a working app, not a static showcase. It grew
                        from a personal Telegram bot plus Google Sheets workflow
                        into the product surfaces a finance tracker needs while
                        keeping the implementation open-source and small enough
                        to inspect or self-host, including multiple currencies
                        and Frankfurter-backed automatic conversion.
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
                            text: 'Let approved agents read or manage vendors, categories, and transactions through tool calls.'
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

            <CtaPanel />
        </PublicPageShell>
    );
}
