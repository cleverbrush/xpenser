import { Badge, Button } from '@xpenser/ui';
import {
    BotIcon,
    ExternalLinkIcon,
    FileJsonIcon,
    GithubIcon,
    KeyRoundIcon
} from 'lucide-react';
import Link from 'next/link';
import {
    apiDocsPage,
    mcpEndpointPath,
    openApiSpecPath
} from '@/lib/public-site';
import { ApiDocsViewer } from './api-docs-viewer';
import { PublicPageShell } from './landing-page';

const apiHighlights = [
    {
        icon: FileJsonIcon,
        text: 'Generated from the same Cleverbrush contracts used by the server handlers and typed client.',
        title: 'Contract-backed OpenAPI'
    },
    {
        icon: KeyRoundIcon,
        text: 'Authenticated endpoints accept bearer tokens and xpenser API keys created from user preferences.',
        title: 'API key ready'
    },
    {
        icon: BotIcon,
        text: `Agent clients can use the MCP Streamable HTTP endpoint at ${mcpEndpointPath}.`,
        title: 'MCP companion endpoint'
    }
] as const;

export function ApiDocsPage() {
    return (
        <PublicPageShell>
            <section className="border-b bg-muted/35">
                <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
                    <Badge className="mb-5 w-fit" variant="secondary">
                        Generated API reference
                    </Badge>
                    <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
                        <div>
                            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                                {apiDocsPage.h1}
                            </h1>
                            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                                {apiDocsPage.description}
                            </p>
                            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Use these docs with a hosted xpenser account or
                                with your own self-hosted deployment. The JSON
                                spec is also available directly for generators
                                and API clients.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Button asChild size="lg">
                                <Link href="/register">Create account</Link>
                            </Button>
                            <Button asChild size="lg" variant="outline">
                                <a href={openApiSpecPath}>
                                    <FileJsonIcon
                                        aria-hidden
                                        className="size-4"
                                    />
                                    OpenAPI JSON
                                </a>
                            </Button>
                            <Button asChild size="lg" variant="outline">
                                <Link href="/personal-finance-api-mcp">
                                    <BotIcon aria-hidden className="size-4" />
                                    API and MCP guide
                                </Link>
                            </Button>
                            <Button asChild size="lg" variant="outline">
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
                                    <ExternalLinkIcon
                                        aria-hidden
                                        className="size-3"
                                    />
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
                <div className="grid gap-3 md:grid-cols-3">
                    {apiHighlights.map(
                        ({ icon: IconComponent, text, title }) => (
                            <div
                                className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
                                key={title}
                            >
                                <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <IconComponent
                                        aria-hidden
                                        className="size-5"
                                    />
                                </div>
                                <h2 className="text-base font-semibold">
                                    {title}
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {text}
                                </p>
                            </div>
                        )
                    )}
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 pb-14 sm:pb-16">
                <ApiDocsViewer />
            </section>
        </PublicPageShell>
    );
}
