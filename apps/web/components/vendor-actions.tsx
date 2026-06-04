'use client';

import {
    type SchemaFormInstance,
    type UseFieldResult,
    useSchemaForm
} from '@cleverbrush/react-form';
import { object, string } from '@cleverbrush/schema';
import {
    FieldLimits,
    type Vendor,
    type VendorCandidate
} from '@xpenser/contracts';
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
import { type FormEvent, useCallback, useEffect, useState } from 'react';
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
        .required('Display name is required.')
        .nonempty('Display name is required.')
        .maxLength(FieldLimits.vendorName, 'Display name is too long.'),
    domain: string().maxLength(
        FieldLimits.vendorDomain,
        'Website is too long.'
    ),
    description: string().maxLength(
        FieldLimits.vendorDescription,
        'Description is too long.'
    ),
    logoUrl: string().maxLength(
        FieldLimits.vendorLogoUrl,
        'Logo URL is too long.'
    ),
    primaryColor: string().maxLength(
        FieldLimits.vendorPrimaryColor,
        'Primary color is too long.'
    )
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

type VendorEditForm = SchemaFormInstance<typeof VendorEditFormSchema>;

type VendorDialogMode = 'edit' | 'refresh';

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

function shouldShowFieldError(
    field: UseFieldResult<string>,
    submitted: boolean
): boolean {
    return Boolean(field.error) && (submitted || field.touched);
}

function VendorTextField({
    field,
    id,
    label,
    maxLength,
    name,
    placeholder,
    required,
    submitted
}: {
    readonly field: UseFieldResult<string>;
    readonly id: string;
    readonly label: string;
    readonly maxLength?: number;
    readonly name: string;
    readonly placeholder?: string;
    readonly required?: boolean;
    readonly submitted: boolean;
}) {
    const invalid = shouldShowFieldError(field, submitted);
    const errorId = `${id}-error`;

    return (
        <Field data-invalid={invalid ? true : undefined}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
                aria-describedby={invalid ? errorId : undefined}
                aria-invalid={invalid}
                id={id}
                maxLength={maxLength}
                name={name}
                onBlur={field.onBlur}
                onChange={event => field.onChange(event.target.value)}
                placeholder={placeholder}
                required={required}
                value={String(field.value ?? '')}
            />
            {invalid ? (
                <FieldError id={errorId} role="alert">
                    {field.error}
                </FieldError>
            ) : null}
        </Field>
    );
}

function VendorTextareaField({
    field,
    id,
    label,
    maxLength,
    name,
    submitted
}: {
    readonly field: UseFieldResult<string>;
    readonly id: string;
    readonly label: string;
    readonly maxLength?: number;
    readonly name: string;
    readonly submitted: boolean;
}) {
    const invalid = shouldShowFieldError(field, submitted);
    const errorId = `${id}-error`;

    return (
        <Field
            className="sm:col-span-2"
            data-invalid={invalid ? true : undefined}
        >
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <textarea
                aria-describedby={invalid ? errorId : undefined}
                aria-invalid={invalid}
                className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                id={id}
                maxLength={maxLength}
                name={name}
                onBlur={field.onBlur}
                onChange={event => field.onChange(event.target.value)}
                value={String(field.value ?? '')}
            />
            {invalid ? (
                <FieldError id={errorId} role="alert">
                    {field.error}
                </FieldError>
            ) : null}
        </Field>
    );
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

function VendorProfileDialogForm({
    form,
    mode,
    onSaved,
    vendor
}: {
    readonly form: VendorEditForm;
    readonly mode: VendorDialogMode;
    readonly onSaved: () => void;
    readonly vendor: Vendor;
}) {
    const name = form.useField(field => field.name);
    const domain = form.useField(field => field.domain);
    const logoUrl = form.useField(field => field.logoUrl);
    const primaryColor = form.useField(field => field.primaryColor);
    const description = form.useField(field => field.description);
    const [pending, setPending] = useState(false);
    const [suggestionPending, setSuggestionPending] = useState(false);
    const [searchPending, setSearchPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
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
        if (query.length < 2) {
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
    }, [search]);

    const loadSuggestion = useCallback(
        async (candidate: {
            readonly brandfetchBrandId?: string;
            readonly domain?: string;
            readonly fallback?: VendorCandidate;
        }) => {
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
        },
        [form, vendor.domain, vendor.name]
    );

    useEffect(() => {
        if (mode !== 'refresh') {
            return;
        }

        if (vendor.domain) {
            void loadSuggestion({ domain: vendor.domain });
        } else {
            setSearch(vendor.name);
        }
    }, [loadSuggestion, mode, vendor.domain, vendor.name]);

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
        setSubmitted(true);
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
            onSaved();
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
                    <VendorTextField
                        field={name}
                        id="vendor-name"
                        label="Display name"
                        maxLength={FieldLimits.vendorName}
                        name="name"
                        required
                        submitted={submitted}
                    />
                    <VendorTextField
                        field={domain}
                        id="vendor-domain"
                        label="Website"
                        maxLength={FieldLimits.vendorDomain}
                        name="domain"
                        placeholder="walmart.com"
                        submitted={submitted}
                    />
                    <VendorTextField
                        field={logoUrl}
                        id="vendor-logo-url"
                        label="Logo URL"
                        maxLength={FieldLimits.vendorLogoUrl}
                        name="logoUrl"
                        placeholder="https://example.com/logo.svg"
                        submitted={submitted}
                    />
                    <VendorTextField
                        field={primaryColor}
                        id="vendor-primary-color"
                        label="Primary color"
                        maxLength={FieldLimits.vendorPrimaryColor}
                        name="primaryColor"
                        placeholder="#2563eb"
                        submitted={submitted}
                    />
                    <VendorTextareaField
                        field={description}
                        id="vendor-description"
                        label="Description"
                        maxLength={FieldLimits.vendorDescription}
                        name="description"
                        submitted={submitted}
                    />
                </div>

                <Field>
                    <FieldLabel htmlFor="vendor-brand-search">
                        Find brand details
                    </FieldLabel>
                    <Input
                        autoComplete="off"
                        id="vendor-brand-search"
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Search Brandfetch"
                        value={search}
                    />
                    <FieldDescription>
                        Choose a suggested brand, then approve only the fields
                        you want to use.
                    </FieldDescription>
                </Field>

                {searchPending ? (
                    <FieldDescription>Searching brands...</FieldDescription>
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

                {error ? <FieldError role="alert">{error}</FieldError> : null}
                <DialogFooter>
                    <Button disabled={pending} type="submit">
                        {pending ? 'Saving...' : 'Save vendor'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
}

export function VendorProfileActions({ vendor }: { readonly vendor: Vendor }) {
    const router = useRouter();
    const form = useSchemaForm(VendorEditFormSchema);
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<VendorDialogMode>('edit');

    function openDialog(nextMode: VendorDialogMode) {
        form.reset(vendorProfileValues(vendor));
        setMode(nextMode);
        setOpen(true);
    }

    return (
        <>
            <Button
                onClick={() => openDialog('edit')}
                size="sm"
                type="button"
                variant="outline"
            >
                <PencilIcon aria-hidden className="size-4" />
                Edit
            </Button>
            <Button
                onClick={() => openDialog('refresh')}
                size="sm"
                type="button"
                variant="outline"
            >
                <RefreshCwIcon aria-hidden className="size-4" />
                Refresh details
            </Button>
            <Dialog onOpenChange={setOpen} open={open}>
                {open ? (
                    <VendorProfileDialogForm
                        form={form}
                        mode={mode}
                        onSaved={() => {
                            router.refresh();
                            setOpen(false);
                        }}
                        vendor={vendor}
                    />
                ) : null}
            </Dialog>
        </>
    );
}
