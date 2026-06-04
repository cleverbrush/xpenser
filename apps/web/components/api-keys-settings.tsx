'use client';

import {
    type ApiKey,
    type CreateApiKeyResponse,
    FieldLimits
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
    Trash2Icon
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { createApiKeyAction, revokeApiKeyAction } from '@/lib/actions';
import { formatDateTime } from '@/lib/format';

type ApiKeysSettingsProps = {
    readonly apiKeys: readonly ApiKey[];
};

export function ApiKeysSettings({ apiKeys }: ApiKeysSettingsProps) {
    const [keys, setKeys] = useState<readonly ApiKey[]>(apiKeys);
    const [created, setCreated] = useState<CreateApiKeyResponse | null>(null);
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pendingCreate, setPendingCreate] = useState(false);
    const [pendingRevokeId, setPendingRevokeId] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

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

    return (
        <div className="flex flex-col gap-5">
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
