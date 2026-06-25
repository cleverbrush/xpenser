import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { ShieldCheckIcon, XIcon } from 'lucide-react';
import { redirect } from 'next/navigation';
import { approveMcpOAuthAction, denyMcpOAuthAction } from '@/lib/actions';
import { getApiClient, getCurrentSession } from '@/lib/api';

type AuthorizeSearchParams = {
    readonly response_type?: string | string[];
    readonly client_id?: string | string[];
    readonly redirect_uri?: string | string[];
    readonly code_challenge?: string | string[];
    readonly code_challenge_method?: string | string[];
    readonly state?: string | string[];
    readonly scope?: string | string[];
};

function first(value: string | string[] | undefined): string {
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function authorizationQuery(params: AuthorizeSearchParams) {
    return {
        response_type: first(params.response_type),
        client_id: first(params.client_id),
        redirect_uri: first(params.redirect_uri),
        code_challenge: first(params.code_challenge),
        code_challenge_method: first(params.code_challenge_method),
        state: first(params.state) || undefined,
        scope: first(params.scope) || undefined
    };
}

function authorizeCallbackPath(query: ReturnType<typeof authorizationQuery>) {
    const params = new URLSearchParams();
    params.set('response_type', query.response_type);
    params.set('client_id', query.client_id);
    params.set('redirect_uri', query.redirect_uri);
    params.set('code_challenge', query.code_challenge);
    params.set('code_challenge_method', query.code_challenge_method);
    if (query.state) {
        params.set('state', query.state);
    }
    if (query.scope) {
        params.set('scope', query.scope);
    }
    return `/mcp/oauth/authorize?${params.toString()}`;
}

function HiddenOAuthFields({
    query
}: {
    readonly query: ReturnType<typeof authorizationQuery>;
}) {
    return (
        <>
            <input
                name="response_type"
                type="hidden"
                value={query.response_type}
            />
            <input name="client_id" type="hidden" value={query.client_id} />
            <input
                name="redirect_uri"
                type="hidden"
                value={query.redirect_uri}
            />
            <input
                name="code_challenge"
                type="hidden"
                value={query.code_challenge}
            />
            <input
                name="code_challenge_method"
                type="hidden"
                value={query.code_challenge_method}
            />
            {query.state ? (
                <input name="state" type="hidden" value={query.state} />
            ) : null}
            {query.scope ? (
                <input name="scope" type="hidden" value={query.scope} />
            ) : null}
        </>
    );
}

export const dynamic = 'force-dynamic';

export default async function McpOAuthAuthorizePage({
    searchParams
}: {
    readonly searchParams: Promise<AuthorizeSearchParams>;
}) {
    const params = await searchParams;
    const query = authorizationQuery(params);
    const session = await getCurrentSession();
    if (!session?.apiToken) {
        redirect(
            `/login?callbackUrl=${encodeURIComponent(
                authorizeCallbackPath(query)
            )}`
        );
    }

    const client = await getApiClient();
    let request:
        | Awaited<ReturnType<typeof client.oauth.authorizationRequest>>
        | undefined;
    try {
        request = await client.oauth.authorizationRequest({ query });
    } catch {
        request = undefined;
    }

    if (!request) {
        return (
            <main className="flex min-h-dvh items-center justify-center bg-muted px-3 py-6 sm:px-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>MCP connection failed</CardTitle>
                        <CardDescription>
                            The authorization request is invalid or expired.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </main>
        );
    }

    const redirectHost = new URL(request.redirectUri).host;

    return (
        <main className="flex min-h-dvh items-center justify-center bg-muted px-3 py-6 sm:px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Connect MCP client</CardTitle>
                    <CardDescription>
                        {request.clientName} wants MCP access to your xpenser
                        account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="rounded-md border bg-background p-3 text-sm">
                        <div className="font-medium">Requested access</div>
                        <p className="mt-1 text-muted-foreground">
                            Read and manage vendors, categories, transactions,
                            dashboards, and reports.
                        </p>
                    </div>
                    <div className="rounded-md border bg-background p-3 text-sm">
                        <div className="font-medium">Return to</div>
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                            {redirectHost}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <form action={approveMcpOAuthAction} className="flex-1">
                            <HiddenOAuthFields query={query} />
                            <Button className="w-full" type="submit">
                                <ShieldCheckIcon className="size-4" />
                                Allow
                            </Button>
                        </form>
                        <form action={denyMcpOAuthAction} className="flex-1">
                            <HiddenOAuthFields query={query} />
                            <Button
                                className="w-full"
                                type="submit"
                                variant="outline"
                            >
                                <XIcon className="size-4" />
                                Deny
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
