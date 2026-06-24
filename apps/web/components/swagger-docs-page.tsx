import { Badge, Button } from '@xpenser/ui';
import { ArrowLeftIcon, FileJsonIcon } from 'lucide-react';
import Link from 'next/link';
import { openApiSpecPath } from '@/lib/public-site';
import { PublicPageShell } from './landing-page';
import { SwaggerUiViewer } from './swagger-ui-viewer';

export function SwaggerDocsPage() {
    return (
        <PublicPageShell>
            <section className="border-b bg-muted/35">
                <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
                    <Badge className="mb-4 w-fit" variant="secondary">
                        Swagger UI
                    </Badge>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                                xpenser Swagger reference
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Browse and expand the generated OpenAPI contract
                                directly in Swagger UI.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button asChild variant="outline">
                                <Link href="/api-docs">
                                    <ArrowLeftIcon
                                        aria-hidden
                                        className="size-4"
                                    />
                                    API docs
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <a href={openApiSpecPath}>
                                    <FileJsonIcon
                                        aria-hidden
                                        className="size-4"
                                    />
                                    OpenAPI JSON
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>
            <section className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
                <SwaggerUiViewer />
            </section>
        </PublicPageShell>
    );
}
