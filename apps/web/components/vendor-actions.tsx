'use client';

import type { Vendor } from '@xpenser/contracts';
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
import { retryVendorEnrichmentAction, updateVendorAction } from '@/lib/actions';
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

export function EditVendorButton({ vendor }: { readonly vendor: Vendor }) {
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
            await updateVendorAction(formData);
            router.refresh();
            setOpen(false);
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError(errorMessage(caught, 'Could not save vendor.'));
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
                    <DialogTitle>Edit vendor</DialogTitle>
                </DialogHeader>
                <form
                    className="flex flex-col gap-4"
                    noValidate
                    onSubmit={handleSubmit}
                >
                    <input name="id" type="hidden" value={vendor.id} />
                    <Field>
                        <FieldLabel htmlFor="vendor-name">Name</FieldLabel>
                        <Input
                            defaultValue={vendor.name}
                            id="vendor-name"
                            maxLength={160}
                            name="name"
                            required
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="vendor-resolved-name">
                            Resolved name
                        </FieldLabel>
                        <Input
                            defaultValue={vendor.resolvedName ?? ''}
                            id="vendor-resolved-name"
                            maxLength={160}
                            name="resolvedName"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="vendor-domain">Domain</FieldLabel>
                        <Input
                            defaultValue={vendor.domain ?? ''}
                            id="vendor-domain"
                            maxLength={255}
                            name="domain"
                            placeholder="walmart.com"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="vendor-logo-url">
                            Logo URL
                        </FieldLabel>
                        <Input
                            defaultValue={vendor.logoUrl ?? ''}
                            id="vendor-logo-url"
                            maxLength={1000}
                            name="logoUrl"
                            placeholder="https://example.com/logo.svg"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="vendor-primary-color">
                            Primary color
                        </FieldLabel>
                        <Input
                            defaultValue={vendor.primaryColor ?? ''}
                            id="vendor-primary-color"
                            maxLength={7}
                            name="primaryColor"
                            placeholder="#2563eb"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="vendor-description">
                            Description
                        </FieldLabel>
                        <textarea
                            className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            defaultValue={vendor.description ?? ''}
                            id="vendor-description"
                            maxLength={1000}
                            name="description"
                        />
                    </Field>
                    {error ? (
                        <FieldError role="alert">{error}</FieldError>
                    ) : null}
                    <DialogFooter>
                        <Button disabled={pending} type="submit">
                            {pending ? 'Saving...' : 'Save vendor'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function RetryVendorEnrichmentButton({
    vendor
}: {
    readonly vendor: Vendor;
}) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleClick() {
        const formData = new FormData();
        formData.set('id', String(vendor.id));
        setPending(true);
        setError(null);
        try {
            await retryVendorEnrichmentAction(formData);
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
