'use client';

import {
    type ApiKey,
    type CreateApiKeyResponse,
    FieldLimits,
    type McpOAuthConnection
} from '@xpenser/contracts';
import {
    Badge,
    Button,
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input
} from '@xpenser/ui';
import {
    CheckIcon,
    ClipboardIcon,
    KeyRoundIcon,
    PlugZapIcon,
    Trash2Icon
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
    createApiKeyAction,
    revokeApiKeyAction,
    revokeMcpOAuthConnectionAction
} from '@/lib/actions';
import { formatDateTime } from '@/lib/format';

type ApiKeysSettingsProps = {
    readonly apiKeys: readonly ApiKey[];
    readonly mcpConnections: readonly McpOAuthConnection[];
    readonly mcpUrl: string;
};

const apiKeyAuthorizationHeader = 'Bearer $' + '{XPENSER_API_KEY}';

function CopyButton({
    copiedLabel = 'Copied',
    text
}: {
    readonly copiedLabel?: string;
    readonly text: string;
}) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        await navigator.clipboard.writeText(text);
        setCopied(true);
    }

    return (
        <Button onClick={handleCopy} type="button" variant="outline">
            {copied ? (
                <CheckIcon className="size-4" />
            ) : (
                <ClipboardIcon className="size-4" />
            )}
            {copied ? copiedLabel : 'Copy'}
        </Button>
    );
}

function Snippet({
    label,
    value
}: {
    readonly label: string;
    readonly value: string;
}) {
    return (
        <div className="rounded-md border bg-muted/35 p-3">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-medium">{label}</div>
                <CopyButton text={value} />
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-background p-3 font-mono text-xs">
                {value}
            </pre>
        </div>
    );
}

export function ApiKeysSettings({
    apiKeys,
    mcpConnections,
    mcpUrl
}: ApiKeysSettingsProps) {
    const [keys, setKeys] = useState<readonly ApiKey[]>(apiKeys);
    const [connections, setConnections] =
        useState<readonly McpOAuthConnection[]>(mcpConnections);
    const [created, setCreated] = useState<CreateApiKeyResponse | null>(null);
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pendingCreate, setPendingCreate] = useState(false);
    const [pendingRevokeId, setPendingRevokeId] = useState<number | null>(null);
    const [pendingConnectionRevokeId, setPendingConnectionRevokeId] = useState<
        number | null
    >(null);
    const [copied, setCopied] = useState(false);
    const [currentMcpUrl, setCurrentMcpUrl] = useState(mcpUrl);

    useEffect(() => {
        setConnections(mcpConnections);
    }, [mcpConnections]);

    useEffect(() => {
        setKeys(apiKeys);
    }, [apiKeys]);

    useEffect(() => {
        setCurrentMcpUrl(`${window.location.origin}/external-api/mcp`);
    }, []);

    const codexSnippet = useMemo(
        () => `[mcp_servers.xpenser]\nurl = "${currentMcpUrl}"`,
        [currentMcpUrl]
    );
    const cursorSnippet = useMemo(
        () =>
            JSON.stringify(
                {
                    mcpServers: {
                        xpenser: {
                            type: 'streamable-http',
                            url: currentMcpUrl
                        }
                    }
                },
                null,
                2
            ),
        [currentMcpUrl]
    );
    const apiKeySnippet = useMemo(
        () =>
            JSON.stringify(
                {
                    mcpServers: {
                        xpenser: {
                            type: 'streamable-http',
                            url: currentMcpUrl,
                            headers: {
                                Authorization: apiKeyAuthorizationHeader
                            }
                        }
                    }
                },
                null,
                2
            ),
        [currentMcpUrl]
    );

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!name.trim()) {
            setError('API key name is required.');
            return;
        }

        const formData = new FormData(event.currentTarget);
        setPendingCreate(true);
        setError(null);
        setCopied(false);
        try {
            const result = await createApiKeyAction(formData);
            setCreated(result);
            setKeys(current => [result.apiKey, ...current]);
            setName('');
        } catch {
            setError('Could not create API key.');
        } finally {
            setPendingCreate(false);
        }
    }

    async function handleCopy() {
        if (!created) {
            return;
        }
        try {
            await navigator.clipboard.writeText(created.key);
            setCopied(true);
        } catch {
            setError('Could not copy API key.');
        }
    }

    async function handleRevoke(apiKeyId: number) {
        const formData = new FormData();
        formData.set('id', String(apiKeyId));
        setPendingRevokeId(apiKeyId);
        setError(null);
        try {
            await revokeApiKeyAction(formData);
            setKeys(current =>
                current.filter(apiKey => apiKey.id !== apiKeyId)
            );
            if (created?.apiKey.id === apiKeyId) {
                setCreated(null);
            }
        } catch {
            setError('Could not revoke API key.');
        } finally {
            setPendingRevokeId(null);
        }
    }

    async function handleConnectionRevoke(connectionId: number) {
        const formData = new FormData();
        formData.set('id', String(connectionId));
        setPendingConnectionRevokeId(connectionId);
        setError(null);
        try {
            await revokeMcpOAuthConnectionAction(formData);
            setConnections(current =>
                current.filter(connection => connection.id !== connectionId)
            );
        } catch {
            setError('Could not revoke MCP connection.');
        } finally {
            setPendingConnectionRevokeId(null);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-4">
                <div className="rounded-md border bg-muted/35 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 font-medium">
                                <PlugZapIcon className="size-4" />
                                MCP server
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Connect AI clients to your vendors, categories,
                                transactions, dashboards, and reports.
                            </p>
                            <p className="break-all font-mono text-xs">
                                {currentMcpUrl}
                            </p>
                        </div>
                        <CopyButton
                            copiedLabel="URL copied"
                            text={currentMcpUrl}
                        />
                    </div>
                </div>

                <div className="grid gap-3 text-sm">
                    <div>
                        <div className="font-medium">Claude</div>
                        <p className="text-muted-foreground">
                            Add a custom connector in Claude settings and use
                            the MCP URL above. Claude will open the xpenser
                            approval screen.
                        </p>
                    </div>
                    <div>
                        <div className="font-medium">Codex</div>
                        <p className="text-muted-foreground">
                            Add this to{' '}
                            <code className="font-mono">
                                ~/.codex/config.toml
                            </code>
                            , then run{' '}
                            <code className="font-mono">
                                codex mcp login xpenser
                            </code>
                            .
                        </p>
                    </div>
                    <Snippet label="Codex config.toml" value={codexSnippet} />
                    <div>
                        <div className="font-medium">Cursor</div>
                        <p className="text-muted-foreground">
                            Add this to{' '}
                            <code className="font-mono">.cursor/mcp.json</code>{' '}
                            or{' '}
                            <code className="font-mono">
                                ~/.cursor/mcp.json
                            </code>
                            , then authenticate from Cursor if prompted.
                        </p>
                    </div>
                    <Snippet label="Cursor mcp.json" value={cursorSnippet} />
                    <div>
                        <div className="font-medium">API key fallback</div>
                        <p className="text-muted-foreground">
                            Use this only for clients that support custom bearer
                            headers but not MCP OAuth.
                        </p>
                    </div>
                    <Snippet
                        label="Bearer header config"
                        value={apiKeySnippet}
                    />
                </div>

                <div className="divide-y rounded-md border">
                    {connections.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground">
                            No MCP OAuth connections.
                        </div>
                    ) : (
                        connections.map(connection => (
                            <div
                                className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                                key={connection.id}
                            >
                                <div className="min-w-0 space-y-1">
                                    <div className="truncate font-medium">
                                        {connection.clientName}
                                    </div>
                                    <p className="break-all font-mono text-xs text-muted-foreground">
                                        {connection.clientId}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Connected{' '}
                                        {formatDateTime(connection.createdAt)}
                                        {connection.lastUsedAt
                                            ? ` - Last used ${formatDateTime(
                                                  connection.lastUsedAt
                                              )}`
                                            : ''}
                                    </p>
                                </div>
                                <Button
                                    className="w-full sm:w-auto"
                                    disabled={
                                        pendingConnectionRevokeId ===
                                        connection.id
                                    }
                                    onClick={() =>
                                        handleConnectionRevoke(connection.id)
                                    }
                                    type="button"
                                    variant="outline"
                                >
                                    <Trash2Icon className="size-4" />
                                    {pendingConnectionRevokeId === connection.id
                                        ? 'Revoking...'
                                        : 'Revoke'}
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </section>

            <form noValidate onSubmit={handleCreate}>
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="api-key-name">Name</FieldLabel>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                id="api-key-name"
                                maxLength={FieldLimits.apiKeyName}
                                name="name"
                                onChange={event => setName(event.target.value)}
                                placeholder="Laptop import script"
                                value={name}
                            />
                            <Button
                                className="w-full sm:w-auto"
                                disabled={pendingCreate}
                                type="submit"
                            >
                                <KeyRoundIcon className="size-4" />
                                {pendingCreate ? 'Creating...' : 'Create key'}
                            </Button>
                        </div>
                    </Field>
                    {error ? (
                        <FieldError role="alert">{error}</FieldError>
                    ) : null}
                </FieldGroup>
            </form>

            {created ? (
                <div className="rounded-md border bg-muted/35 p-3">
                    <Field>
                        <FieldLabel htmlFor="new-api-key">
                            New API key
                        </FieldLabel>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                className="font-mono text-xs"
                                id="new-api-key"
                                readOnly
                                value={created.key}
                            />
                            <Button
                                className="w-full sm:w-auto"
                                onClick={handleCopy}
                                type="button"
                                variant="outline"
                            >
                                {copied ? (
                                    <CheckIcon className="size-4" />
                                ) : (
                                    <ClipboardIcon className="size-4" />
                                )}
                                {copied ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                    </Field>
                </div>
            ) : null}

            <div className="divide-y rounded-md border">
                {keys.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                        No API keys.
                    </div>
                ) : (
                    keys.map(apiKey => (
                        <div
                            className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                            key={apiKey.id}
                        >
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate font-medium">
                                        {apiKey.name}
                                    </span>
                                    <Badge variant="outline">
                                        {apiKey.keyPrefix}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Created {formatDateTime(apiKey.createdAt)}
                                    {apiKey.lastUsedAt
                                        ? ` - Last used ${formatDateTime(
                                              apiKey.lastUsedAt
                                          )}`
                                        : ''}
                                </p>
                            </div>
                            <Button
                                className="w-full sm:w-auto"
                                disabled={pendingRevokeId === apiKey.id}
                                onClick={() => handleRevoke(apiKey.id)}
                                type="button"
                                variant="outline"
                            >
                                <Trash2Icon className="size-4" />
                                {pendingRevokeId === apiKey.id
                                    ? 'Revoking...'
                                    : 'Revoke'}
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
