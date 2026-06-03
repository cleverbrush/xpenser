'use client';

import type { Merchant } from '@xpenser/contracts';
import {
    Button,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Field,
    FieldError,
    FieldLabel,
    Input
} from '@xpenser/ui';
import { PencilIcon, RefreshCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import {
    retryMerchantEnrichmentAction,
    updateMerchantAction
} from '@/lib/actions';
import { isNextRedirectError } from './forms/form-utils';

function errorMessage(error: unknown, fallback: string): string {
    const body =
        typeof error === 'object' && error !== null && 'body' in error
            ? (error as { readonly body?: unknown }).body
            : undefined;
    if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
    ) {
        return body.message;
    }
    return fallback;
}

export function EditMerchantButton({
    merchant
}: {
    readonly merchant: Merchant;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setPending(true);
        setError(null);
        try {
            await updateMerchantAction(formData);
            router.refresh();
            setOpen(false);
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError(errorMessage(caught, 'Could not save merchant.'));
        } finally {
            setPending(false);
        }
    }

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (!nextOpen) {
            setError(null);
        }
    }

    return (
        <Dialog onOpenChange={handleOpenChange} open={open}>
            <DialogTrigger asChild>
                <Button size="sm" type="button" variant="outline">
                    <PencilIcon aria-hidden className="size-4" />
                    Edit
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit merchant</DialogTitle>
                </DialogHeader>
                <form
                    className="flex flex-col gap-4"
                    noValidate
                    onSubmit={handleSubmit}
                >
                    <input name="id" type="hidden" value={merchant.id} />
                    <Field>
                        <FieldLabel htmlFor="merchant-name">Name</FieldLabel>
                        <Input
                            defaultValue={merchant.name}
                            id="merchant-name"
                            maxLength={160}
                            name="name"
                            required
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="merchant-brand-name">
                            Brand name
                        </FieldLabel>
                        <Input
                            defaultValue={merchant.brandName ?? ''}
                            id="merchant-brand-name"
                            maxLength={160}
                            name="brandName"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="merchant-domain">
                            Domain
                        </FieldLabel>
                        <Input
                            defaultValue={merchant.domain ?? ''}
                            id="merchant-domain"
                            maxLength={255}
                            name="domain"
                            placeholder="walmart.com"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="merchant-logo-url">
                            Logo URL
                        </FieldLabel>
                        <Input
                            defaultValue={merchant.logoUrl ?? ''}
                            id="merchant-logo-url"
                            maxLength={1000}
                            name="logoUrl"
                            placeholder="https://example.com/logo.svg"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="merchant-primary-color">
                            Primary color
                        </FieldLabel>
                        <Input
                            defaultValue={merchant.primaryColor ?? ''}
                            id="merchant-primary-color"
                            maxLength={7}
                            name="primaryColor"
                            placeholder="#2563eb"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="merchant-description">
                            Description
                        </FieldLabel>
                        <textarea
                            className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            defaultValue={merchant.description ?? ''}
                            id="merchant-description"
                            maxLength={1000}
                            name="description"
                        />
                    </Field>
                    {error ? (
                        <FieldError role="alert">{error}</FieldError>
                    ) : null}
                    <DialogFooter>
                        <Button disabled={pending} type="submit">
                            {pending ? 'Saving...' : 'Save merchant'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function RetryMerchantEnrichmentButton({
    merchant
}: {
    readonly merchant: Merchant;
}) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleClick() {
        const formData = new FormData();
        formData.set('id', String(merchant.id));
        setPending(true);
        setError(null);
        try {
            await retryMerchantEnrichmentAction(formData);
            router.refresh();
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError(errorMessage(caught, 'Could not retry enrichment.'));
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="flex flex-col items-start gap-2">
            <Button
                disabled={pending}
                onClick={() => {
                    void handleClick();
                }}
                size="sm"
                type="button"
                variant="outline"
            >
                <RefreshCwIcon aria-hidden className="size-4" />
                {pending ? 'Retrying...' : 'Retry enrichment'}
            </Button>
            {error ? (
                <p className="text-xs text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
