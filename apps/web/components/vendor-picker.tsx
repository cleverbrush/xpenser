'use client';

import {
    FieldLimits,
    type Vendor,
    type VendorCandidate
} from '@xpenser/contracts';
import {
    Button,
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    Input
} from '@xpenser/ui';
import { StoreIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    createVendorAction,
    searchVendorCandidatesAction
} from '@/lib/actions';
import { VendorLogo, vendorDisplayName } from './vendor-display';

function vendorMatches(vendor: Vendor, query: string): boolean {
    const search = query.trim().toLowerCase();
    if (!search) {
        return true;
    }
    return [
        vendor.name,
        vendor.displayName,
        vendor.resolvedName,
        vendor.domain,
        vendor.description
    ].some(value => value?.toLowerCase().includes(search));
}

function normalizedVendorSearch(value: string | undefined): string {
    return value?.trim().toLowerCase() ?? '';
}

function vendorExactMatch(vendor: Vendor, query: string): boolean {
    const search = normalizedVendorSearch(query);
    if (!search) {
        return false;
    }

    return [
        vendor.name,
        vendor.displayName,
        vendor.resolvedName,
        vendor.domain
    ].some(value => normalizedVendorSearch(value) === search);
}

export function VendorPicker({
    vendors,
    onChange,
    selectedVendorId
}: {
    readonly vendors: readonly Vendor[];
    readonly onChange: (vendor: Vendor | undefined) => void;
    readonly selectedVendorId?: number | null;
}) {
    const [items, setItems] = useState<readonly Vendor[]>(vendors);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [candidateSearchPending, setCandidateSearchPending] = useState(false);
    const [candidateSuggestions, setCandidateSuggestions] = useState<
        readonly VendorCandidate[]
    >([]);
    const [error, setError] = useState<string | null>(null);
    const [candidateSearchError, setCandidateSearchError] = useState<
        string | null
    >(null);

    useEffect(() => {
        setItems(vendors);
    }, [vendors]);

    useEffect(() => {
        const search = query.trim();
        if (
            !open ||
            search.length < 2 ||
            items.some(vendor => vendorExactMatch(vendor, search))
        ) {
            setCandidateSuggestions([]);
            setCandidateSearchPending(false);
            setCandidateSearchError(null);
            return;
        }

        let active = true;
        setCandidateSearchError(null);
        const timeout = setTimeout(() => {
            setCandidateSearchPending(true);
            searchVendorCandidatesAction(search)
                .then(results => {
                    if (active) {
                        setCandidateSuggestions(results);
                    }
                })
                .catch(() => {
                    if (active) {
                        setCandidateSuggestions([]);
                        setCandidateSearchError('Could not search vendors.');
                    }
                })
                .finally(() => {
                    if (active) {
                        setCandidateSearchPending(false);
                    }
                });
        }, 300);

        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [items, open, query]);

    const selected = useMemo(
        () => items.find(vendor => vendor.id === selectedVendorId),
        [items, selectedVendorId]
    );
    const visible = useMemo(
        () => items.filter(vendor => vendorMatches(vendor, query)).slice(0, 6),
        [items, query]
    );
    const visibleCandidateSuggestions = useMemo(
        () =>
            candidateSuggestions
                .filter(
                    suggestion =>
                        !items.some(
                            vendor =>
                                vendor.domain === suggestion.domain ||
                                vendor.logoUrl === suggestion.logoUrl
                        )
                )
                .slice(0, 4),
        [candidateSuggestions, items]
    );
    const normalizedQuery = query.trim().toLowerCase();
    const canCreate =
        query.trim() !== '' &&
        !items.some(vendor => vendorExactMatch(vendor, normalizedQuery));

    async function saveVendor(formData: FormData) {
        setPending(true);
        setError(null);
        try {
            const vendor = await createVendorAction(formData);
            setItems(current => {
                const withoutDuplicate = current.filter(
                    item => item.id !== vendor.id
                );
                return [vendor, ...withoutDuplicate];
            });
            setQuery('');
            setOpen(false);
            setCandidateSuggestions([]);
            onChange(vendor);
        } catch {
            setError('Could not save vendor.');
        } finally {
            setPending(false);
        }
    }

    async function createVendor() {
        const name = query.trim();
        if (!name || pending) {
            return;
        }

        const formData = new FormData();
        formData.set('name', name);
        await saveVendor(formData);
    }

    async function createVendorFromCandidate(suggestion: VendorCandidate) {
        if (pending) {
            return;
        }

        const formData = new FormData();
        formData.set('name', suggestion.name);
        formData.set('resolvedName', suggestion.name);
        formData.set('domain', suggestion.domain);
        if (suggestion.brandfetchBrandId) {
            formData.set('brandfetchBrandId', suggestion.brandfetchBrandId);
        }
        if (suggestion.logoUrl) {
            formData.set('logoUrl', suggestion.logoUrl);
        }
        await saveVendor(formData);
    }

    function clearSelection() {
        setQuery('');
        setOpen(false);
        setCandidateSuggestions([]);
        setCandidateSearchError(null);
        onChange(undefined);
    }

    return (
        <Field>
            <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor={selected ? undefined : 'vendor-search'}>
                    Vendor
                </FieldLabel>
                {selected ? (
                    <Button
                        className="h-7 px-2"
                        onClick={clearSelection}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        <XIcon aria-hidden className="size-3.5" />
                        Clear
                    </Button>
                ) : null}
            </div>
            {selected ? (
                <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
                    <VendorLogo vendor={selected} size="sm" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                            {vendorDisplayName(selected)}
                        </p>
                        {selected.domain ? (
                            <p className="truncate text-xs text-muted-foreground">
                                {selected.domain}
                            </p>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className="relative">
                    <Input
                        autoComplete="off"
                        id="vendor-search"
                        maxLength={FieldLimits.vendorSearch}
                        onBlur={() => {
                            setTimeout(() => setOpen(false), 100);
                        }}
                        onChange={event => {
                            setQuery(event.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        placeholder="Search vendor"
                        value={query}
                    />
                    {open ? (
                        <div className="absolute z-20 mt-1 flex max-h-72 w-full flex-col gap-1 overflow-auto rounded-md border bg-popover p-1 shadow-md">
                            {visible.map(vendor => (
                                <Button
                                    className="h-auto justify-start gap-2 px-2 py-2"
                                    key={vendor.id}
                                    onMouseDown={event =>
                                        event.preventDefault()
                                    }
                                    onClick={() => {
                                        setQuery('');
                                        setOpen(false);
                                        onChange(vendor);
                                    }}
                                    type="button"
                                    variant="ghost"
                                >
                                    <VendorLogo vendor={vendor} size="sm" />
                                    <span className="min-w-0 text-left">
                                        <span className="block truncate">
                                            {vendorDisplayName(vendor)}
                                        </span>
                                        {vendor.suggestedCategoryDisplayName ? (
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {
                                                    vendor.suggestedCategoryDisplayName
                                                }
                                            </span>
                                        ) : null}
                                    </span>
                                </Button>
                            ))}
                            {visibleCandidateSuggestions.map(suggestion => (
                                <Button
                                    className="h-auto justify-start gap-2 px-2 py-2"
                                    disabled={pending}
                                    key={`${suggestion.brandfetchBrandId ?? suggestion.domain}-${suggestion.domain}`}
                                    onMouseDown={event =>
                                        event.preventDefault()
                                    }
                                    onClick={() =>
                                        void createVendorFromCandidate(
                                            suggestion
                                        )
                                    }
                                    type="button"
                                    variant="ghost"
                                >
                                    <VendorLogo
                                        vendor={{
                                            displayName: suggestion.name,
                                            logoUrl: suggestion.logoUrl,
                                            name: suggestion.name
                                        }}
                                        size="sm"
                                    />
                                    <span className="min-w-0 text-left">
                                        <span className="block truncate">
                                            {suggestion.name}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {suggestion.domain}
                                        </span>
                                    </span>
                                </Button>
                            ))}
                            {canCreate ? (
                                <Button
                                    className="justify-start gap-2"
                                    disabled={pending}
                                    onMouseDown={event =>
                                        event.preventDefault()
                                    }
                                    onClick={createVendor}
                                    type="button"
                                    variant="ghost"
                                >
                                    <StoreIcon aria-hidden className="size-4" />
                                    {pending
                                        ? 'Saving vendor...'
                                        : `Add ${query.trim()}`}
                                </Button>
                            ) : null}
                            {!canCreate && visible.length === 0 ? (
                                <FieldDescription className="px-2 py-1.5">
                                    No matching vendors.
                                </FieldDescription>
                            ) : null}
                            {candidateSearchPending ? (
                                <FieldDescription className="px-2 py-1.5">
                                    Searching vendors...
                                </FieldDescription>
                            ) : null}
                            {candidateSearchError ? (
                                <FieldDescription className="px-2 py-1.5">
                                    {candidateSearchError}
                                </FieldDescription>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            )}
            {error ? <FieldError role="alert">{error}</FieldError> : null}
        </Field>
    );
}
