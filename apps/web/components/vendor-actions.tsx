'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
import { object, string } from '@cleverbrush/schema';
import type { Vendor, VendorCandidate } from '@xpenser/contracts';
import {
    Button,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    Input
} from '@xpenser/ui';
import { PencilIcon, RefreshCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import {
    getVendorCandidateDetailsAction,
    searchVendorCandidatesAction,
    updateVendorAction
} from '@/lib/actions';
import { isNextRedirectError, valuesToFormData } from './forms/form-utils';
import { VendorLogo } from './vendor-display';

type VendorProfileValues = {
    readonly name: string;
    readonly domain: string;
    readonly description: string;
    readonly logoUrl: string;
    readonly primaryColor: string;
};

type VendorProfileField = keyof VendorProfileValues;

const profileFieldLabels: Record<VendorProfileField, string> = {
    name: 'Display name',
    domain: 'Website',
    description: 'Description',
    logoUrl: 'Logo URL',
    primaryColor: 'Primary color'
};

function isHttpsUrl(value: string): boolean {
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

const VendorEditFormSchema = object({
    name: string()
        .required('vendor name is required')
        .nonempty('vendor name is required')
        .maxLength(160, 'vendor name is too long'),
    domain: string().maxLength(255, 'domain is too long'),
    description: string().maxLength(1000, 'description is too long'),
    logoUrl: string().maxLength(1000, 'logo URL is too long'),
    primaryColor: string().maxLength(7, 'primary color is too long')
})
    .addValidator(value => {
        const logoUrl = value.logoUrl.trim();
        if (!logoUrl || isHttpsUrl(logoUrl)) {
            return { valid: true };
        }

        return {
            valid: false,
            errors: [
                {
                    message: 'Logo URL must be a valid HTTPS URL.',
                    property: field => field.logoUrl
                }
            ]
        };
    })
    .addValidator(value => {
        const primaryColor = value.primaryColor.trim();
        if (!primaryColor || /^#[0-9a-f]{6}$/i.test(primaryColor)) {
            return { valid: true };
        }

        return {
            valid: false,
            errors: [
                {
                    message: 'Primary color must be a six-digit hex color.',
                    property: field => field.primaryColor
                }
            ]
        };
    });

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

function vendorProfileValues(vendor: Vendor): VendorProfileValues {
    return {
        name: vendor.name,
        domain: vendor.domain ?? '',
        description: vendor.description ?? '',
        logoUrl: vendor.logoUrl ?? '',
        primaryColor: vendor.primaryColor ?? ''
    };
}

function candidateProfileValues(
    candidate: VendorCandidate
): Partial<VendorProfileValues> {
    return {
        name: candidate.name,
        domain: candidate.domain,
        ...(candidate.description
            ? { description: candidate.description }
            : {}),
        ...(candidate.logoUrl ? { logoUrl: candidate.logoUrl } : {}),
        ...(candidate.primaryColor
            ? { primaryColor: candidate.primaryColor }
            : {})
    };
}

function textValue(value: string | undefined): string {
    return value?.trim() || '-';
}

function suggestionKey(candidate: VendorCandidate): string {
    return `${candidate.brandfetchBrandId ?? candidate.domain}-${candidate.domain}`;
}

function SuggestedFieldReview({
    field,
    onAccept,
    onKeep,
    suggested,
    values
}: {
    readonly field: VendorProfileField;
    readonly onAccept: (field: VendorProfileField) => void;
    readonly onKeep: () => void;
    readonly suggested: Partial<VendorProfileValues>;
    readonly values: VendorProfileValues;
}) {
    const suggestedValue = suggested[field];
    if (!suggestedValue || suggestedValue === values[field]) {
        return null;
    }

    return (
        <div className="rounded-md border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm font-medium">
                        {profileFieldLabels[field]}
                    </p>
                    <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                        <div className="min-w-0">
                            <dt className="text-muted-foreground">Current</dt>
                            <dd className="mt-1 break-words">
                                {textValue(values[field])}
                            </dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-muted-foreground">Suggested</dt>
                            <dd className="mt-1 break-words">
                                {textValue(suggestedValue)}
                            </dd>
                        </div>
                    </dl>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button
                        onClick={() => onAccept(field)}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        Use
                    </Button>
                    <Button
                        onClick={onKeep}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        Keep
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function VendorProfileActions({ vendor }: { readonly vendor: Vendor }) {
    const router = useRouter();
    const form = useSchemaForm(VendorEditFormSchema);
    const name = form.useField(field => field.name);
    const domain = form.useField(field => field.domain);
    const logoUrl = form.useField(field => field.logoUrl);
    const primaryColor = form.useField(field => field.primaryColor);
    const description = form.useField(field => field.description);
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [suggestionPending, setSuggestionPending] = useState(false);
    const [searchPending, setSearchPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [candidates, setCandidates] = useState<readonly VendorCandidate[]>(
        []
    );
    const [suggested, setSuggested] =
        useState<Partial<VendorProfileValues> | null>(null);

    const values: VendorProfileValues = {
        name: String(name.value ?? ''),
        domain: String(domain.value ?? ''),
        description: String(description.value ?? ''),
        logoUrl: String(logoUrl.value ?? ''),
        primaryColor: String(primaryColor.value ?? '')
    };

    const suggestedFields = suggested
        ? (Object.keys(profileFieldLabels) as VendorProfileField[])
              .filter(field => suggested[field])
              .filter(field => suggested[field] !== values[field])
        : [];

    useEffect(() => {
        const query = search.trim();
        if (!open || query.length < 2) {
            setCandidates([]);
            setSearchPending(false);
            setSearchError(null);
            return;
        }

        let active = true;
        setSearchError(null);
        const timeout = setTimeout(() => {
            setSearchPending(true);
            searchVendorCandidatesAction(query)
                .then(results => {
                    if (active) {
                        setCandidates(results);
                    }
                })
                .catch(() => {
                    if (active) {
                        setCandidates([]);
                        setSearchError('Could not search vendors.');
                    }
                })
                .finally(() => {
                    if (active) {
                        setSearchPending(false);
                    }
                });
        }, 300);

        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [open, search]);

    function resetDialog() {
        form.reset(vendorProfileValues(vendor));
        setSearch('');
        setCandidates([]);
        setSuggested(null);
        setError(null);
        setSearchError(null);
        setPending(false);
        setSuggestionPending(false);
        setSearchPending(false);
    }

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (!nextOpen) {
            resetDialog();
        }
    }

    function openEditor() {
        resetDialog();
        setOpen(true);
    }

    async function loadSuggestion(candidate: {
        readonly brandfetchBrandId?: string;
        readonly domain?: string;
        readonly fallback?: VendorCandidate;
    }) {
        const currentValues = form.getValue();
        setSuggestionPending(true);
        setError(null);
        try {
            const details = await getVendorCandidateDetailsAction({
                brandfetchBrandId: candidate.brandfetchBrandId,
                domain: candidate.domain
            });
            const nextSuggestion = candidateProfileValues(
                details ??
                    candidate.fallback ?? {
                        name:
                            candidate.domain ??
                            currentValues.name ??
                            vendor.name,
                        domain:
                            candidate.domain ??
                            currentValues.domain ??
                            vendor.domain ??
                            ''
                    }
            );
            setSuggested(nextSuggestion);
            setSearch('');
            setCandidates([]);
        } catch {
            setError('Could not load suggested vendor details.');
        } finally {
            setSuggestionPending(false);
        }
    }

    async function openRefresh() {
        resetDialog();
        setOpen(true);
        if (vendor.domain) {
            await loadSuggestion({ domain: vendor.domain });
        } else {
            setSearch(vendor.name);
        }
    }

    function setField(field: VendorProfileField, value: string) {
        switch (field) {
            case 'name':
                name.onChange(value);
                return;
            case 'domain':
                domain.onChange(value);
                return;
            case 'description':
                description.onChange(value);
                return;
            case 'logoUrl':
                logoUrl.onChange(value);
                return;
            case 'primaryColor':
                primaryColor.onChange(value);
                return;
        }
    }

    function acceptSuggestion(field: VendorProfileField) {
        const suggestedValue = suggested?.[field];
        if (!suggestedValue) {
            return;
        }
        setField(field, suggestedValue);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        const formData = valuesToFormData(result.object);
        formData.set('id', String(vendor.id));
        setPending(true);
        try {
            const response = await updateVendorAction(formData);
            if (response.error) {
                setError(response.error);
                return;
            }
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

    return (
        <>
            <Button
                onClick={openEditor}
                size="sm"
                type="button"
                variant="outline"
            >
                <PencilIcon aria-hidden className="size-4" />
                Edit
            </Button>
            <Button
                disabled={suggestionPending}
                onClick={() => {
                    void openRefresh();
                }}
                size="sm"
                type="button"
                variant="outline"
            >
                <RefreshCwIcon aria-hidden className="size-4" />
                {suggestionPending ? 'Refreshing...' : 'Refresh details'}
            </Button>
            <Dialog onOpenChange={handleOpenChange} open={open}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit vendor</DialogTitle>
                    </DialogHeader>
                    <form
                        className="flex flex-col gap-5"
                        noValidate
                        onSubmit={handleSubmit}
                    >
                        <input name="id" type="hidden" value={vendor.id} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                data-invalid={
                                    name.touched && name.error
                                        ? true
                                        : undefined
                                }
                            >
                                <FieldLabel htmlFor="vendor-name">
                                    Display name
                                </FieldLabel>
                                <Input
                                    aria-invalid={
                                        name.touched && Boolean(name.error)
                                    }
                                    id="vendor-name"
                                    maxLength={160}
                                    name="name"
                                    onBlur={name.onBlur}
                                    onChange={event =>
                                        name.onChange(event.target.value)
                                    }
                                    required
                                    value={values.name}
                                />
                                {name.touched && name.error ? (
                                    <FieldError>{name.error}</FieldError>
                                ) : null}
                            </Field>
                            <Field
                                data-invalid={
                                    domain.touched && domain.error
                                        ? true
                                        : undefined
                                }
                            >
                                <FieldLabel htmlFor="vendor-domain">
                                    Website
                                </FieldLabel>
                                <Input
                                    aria-invalid={
                                        domain.touched && Boolean(domain.error)
                                    }
                                    id="vendor-domain"
                                    maxLength={255}
                                    name="domain"
                                    onBlur={domain.onBlur}
                                    onChange={event =>
                                        domain.onChange(event.target.value)
                                    }
                                    placeholder="walmart.com"
                                    value={values.domain}
                                />
                                {domain.touched && domain.error ? (
                                    <FieldError>{domain.error}</FieldError>
                                ) : null}
                            </Field>
                            <Field
                                data-invalid={
                                    logoUrl.touched && logoUrl.error
                                        ? true
                                        : undefined
                                }
                            >
                                <FieldLabel htmlFor="vendor-logo-url">
                                    Logo URL
                                </FieldLabel>
                                <Input
                                    aria-invalid={
                                        logoUrl.touched &&
                                        Boolean(logoUrl.error)
                                    }
                                    id="vendor-logo-url"
                                    maxLength={1000}
                                    name="logoUrl"
                                    onBlur={logoUrl.onBlur}
                                    onChange={event =>
                                        logoUrl.onChange(event.target.value)
                                    }
                                    placeholder="https://example.com/logo.svg"
                                    value={values.logoUrl}
                                />
                                {logoUrl.touched && logoUrl.error ? (
                                    <FieldError>{logoUrl.error}</FieldError>
                                ) : null}
                            </Field>
                            <Field
                                data-invalid={
                                    primaryColor.touched && primaryColor.error
                                        ? true
                                        : undefined
                                }
                            >
                                <FieldLabel htmlFor="vendor-primary-color">
                                    Primary color
                                </FieldLabel>
                                <Input
                                    aria-invalid={
                                        primaryColor.touched &&
                                        Boolean(primaryColor.error)
                                    }
                                    id="vendor-primary-color"
                                    maxLength={7}
                                    name="primaryColor"
                                    onBlur={primaryColor.onBlur}
                                    onChange={event =>
                                        primaryColor.onChange(
                                            event.target.value
                                        )
                                    }
                                    placeholder="#2563eb"
                                    value={values.primaryColor}
                                />
                                {primaryColor.touched && primaryColor.error ? (
                                    <FieldError>
                                        {primaryColor.error}
                                    </FieldError>
                                ) : null}
                            </Field>
                            <Field
                                className="sm:col-span-2"
                                data-invalid={
                                    description.touched && description.error
                                        ? true
                                        : undefined
                                }
                            >
                                <FieldLabel htmlFor="vendor-description">
                                    Description
                                </FieldLabel>
                                <textarea
                                    aria-invalid={
                                        description.touched &&
                                        Boolean(description.error)
                                    }
                                    className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    id="vendor-description"
                                    maxLength={1000}
                                    name="description"
                                    onBlur={description.onBlur}
                                    onChange={event =>
                                        description.onChange(event.target.value)
                                    }
                                    value={values.description}
                                />
                                {description.touched && description.error ? (
                                    <FieldError>{description.error}</FieldError>
                                ) : null}
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel htmlFor="vendor-brand-search">
                                Find brand details
                            </FieldLabel>
                            <Input
                                autoComplete="off"
                                id="vendor-brand-search"
                                onChange={event =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search Brandfetch"
                                value={search}
                            />
                            <FieldDescription>
                                Choose a suggested brand, then approve only the
                                fields you want to use.
                            </FieldDescription>
                        </Field>

                        {searchPending ? (
                            <FieldDescription>
                                Searching brands...
                            </FieldDescription>
                        ) : null}
                        {searchError ? (
                            <FieldDescription>{searchError}</FieldDescription>
                        ) : null}
                        {candidates.length > 0 ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {candidates.slice(0, 6).map(candidate => (
                                    <Button
                                        className="h-auto justify-start gap-2 px-2 py-2"
                                        disabled={suggestionPending}
                                        key={suggestionKey(candidate)}
                                        onClick={() =>
                                            void loadSuggestion({
                                                brandfetchBrandId:
                                                    candidate.brandfetchBrandId,
                                                domain: candidate.domain,
                                                fallback: candidate
                                            })
                                        }
                                        type="button"
                                        variant="outline"
                                    >
                                        <VendorLogo
                                            vendor={{
                                                displayName: candidate.name,
                                                logoUrl: candidate.logoUrl,
                                                name: candidate.name
                                            }}
                                            size="sm"
                                        />
                                        <span className="min-w-0 text-left">
                                            <span className="block truncate">
                                                {candidate.name}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {candidate.domain}
                                            </span>
                                        </span>
                                    </Button>
                                ))}
                            </div>
                        ) : null}

                        {suggestionPending ? (
                            <FieldDescription>
                                Loading suggested details...
                            </FieldDescription>
                        ) : null}
                        {suggested ? (
                            <div className="flex flex-col gap-2">
                                <div>
                                    <p className="text-sm font-medium">
                                        Review suggested changes
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Use only the fields that look correct.
                                    </p>
                                </div>
                                {suggestedFields.length > 0 ? (
                                    suggestedFields.map(field => (
                                        <SuggestedFieldReview
                                            field={field}
                                            key={field}
                                            onAccept={acceptSuggestion}
                                            onKeep={() => {
                                                setSuggested(current => {
                                                    if (!current) {
                                                        return current;
                                                    }
                                                    const next = { ...current };
                                                    delete next[field];
                                                    return next;
                                                });
                                            }}
                                            suggested={suggested}
                                            values={values}
                                        />
                                    ))
                                ) : (
                                    <FieldDescription>
                                        No new suggested fields.
                                    </FieldDescription>
                                )}
                            </div>
                        ) : null}

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
        </>
    );
}
