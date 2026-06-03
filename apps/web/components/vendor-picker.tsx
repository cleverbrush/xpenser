'use client';

import type { Vendor, VendorCandidate } from '@xpenser/contracts';
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
        if (search.length < 2) {
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
    }, [query]);

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
        !items.some(
            vendor =>
                vendor.name.trim().toLowerCase() === normalizedQuery ||
                vendor.displayName.trim().toLowerCase() === normalizedQuery
        );

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
                <Input
                    autoComplete="off"
                    id="vendor-search"
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search vendor"
                    value={query}
                />
            )}
            {!selected ? (
                <div className="flex flex-col gap-1">
                    {visible.map(vendor => (
                        <Button
                            className="h-auto justify-start gap-2 px-2 py-2"
                            key={vendor.id}
                            onClick={() => {
                                setQuery('');
                                onChange(vendor);
                            }}
                            type="button"
                            variant="outline"
                        >
                            <VendorLogo vendor={vendor} size="sm" />
                            <span className="min-w-0 text-left">
                                <span className="block truncate">
                                    {vendorDisplayName(vendor)}
                                </span>
                                {vendor.suggestedCategoryDisplayName ? (
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {vendor.suggestedCategoryDisplayName}
                                    </span>
                                ) : null}
                            </span>
                        </Button>
                    ))}
                    {visibleCandidateSuggestions.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            {visibleCandidateSuggestions.map(suggestion => (
                                <Button
                                    className="h-auto justify-start gap-2 px-2 py-2"
                                    disabled={pending}
                                    key={`${suggestion.brandfetchBrandId ?? suggestion.domain}-${suggestion.domain}`}
                                    onClick={() =>
                                        void createVendorFromCandidate(
                                            suggestion
                                        )
                                    }
                                    type="button"
                                    variant="outline"
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
                        </div>
                    ) : null}
                    {canCreate ? (
                        <Button
                            className="justify-start gap-2"
                            disabled={pending}
                            onClick={createVendor}
                            type="button"
                            variant="outline"
                        >
                            <StoreIcon aria-hidden className="size-4" />
                            {pending
                                ? 'Saving vendor...'
                                : `Add ${query.trim()}`}
                        </Button>
                    ) : null}
                    {!canCreate && visible.length === 0 ? (
                        <FieldDescription>
                            No matching vendors.
                        </FieldDescription>
                    ) : null}
                    {candidateSearchPending ? (
                        <FieldDescription>
                            Searching vendors...
                        </FieldDescription>
                    ) : null}
                    {candidateSearchError ? (
                        <FieldDescription>
                            {candidateSearchError}
                        </FieldDescription>
                    ) : null}
                </div>
            ) : null}
            {error ? <FieldError role="alert">{error}</FieldError> : null}
        </Field>
    );
}
