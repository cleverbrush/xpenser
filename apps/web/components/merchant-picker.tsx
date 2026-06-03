'use client';

import type { Merchant, MerchantBrandSuggestion } from '@xpenser/contracts';
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
    createMerchantAction,
    searchMerchantBrandsAction
} from '@/lib/actions';
import { MerchantLogo, merchantDisplayName } from './merchant-display';

function merchantMatches(merchant: Merchant, query: string): boolean {
    const search = query.trim().toLowerCase();
    if (!search) {
        return true;
    }
    return [
        merchant.name,
        merchant.displayName,
        merchant.brandName,
        merchant.domain,
        merchant.description
    ].some(value => value?.toLowerCase().includes(search));
}

export function MerchantPicker({
    merchants,
    onChange,
    selectedMerchantId
}: {
    readonly merchants: readonly Merchant[];
    readonly onChange: (merchant: Merchant | undefined) => void;
    readonly selectedMerchantId?: number | null;
}) {
    const [items, setItems] = useState<readonly Merchant[]>(merchants);
    const [query, setQuery] = useState('');
    const [pending, setPending] = useState(false);
    const [brandSearchPending, setBrandSearchPending] = useState(false);
    const [brandSuggestions, setBrandSuggestions] = useState<
        readonly MerchantBrandSuggestion[]
    >([]);
    const [error, setError] = useState<string | null>(null);
    const [brandSearchError, setBrandSearchError] = useState<string | null>(
        null
    );

    useEffect(() => {
        setItems(merchants);
    }, [merchants]);

    useEffect(() => {
        const search = query.trim();
        if (search.length < 2) {
            setBrandSuggestions([]);
            setBrandSearchPending(false);
            setBrandSearchError(null);
            return;
        }

        let active = true;
        setBrandSearchError(null);
        const timeout = setTimeout(() => {
            setBrandSearchPending(true);
            searchMerchantBrandsAction(search)
                .then(results => {
                    if (active) {
                        setBrandSuggestions(results);
                    }
                })
                .catch(() => {
                    if (active) {
                        setBrandSuggestions([]);
                        setBrandSearchError('Could not search brands.');
                    }
                })
                .finally(() => {
                    if (active) {
                        setBrandSearchPending(false);
                    }
                });
        }, 300);

        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [query]);

    const selected = useMemo(
        () => items.find(merchant => merchant.id === selectedMerchantId),
        [items, selectedMerchantId]
    );
    const visible = useMemo(
        () =>
            items
                .filter(merchant => merchantMatches(merchant, query))
                .slice(0, 6),
        [items, query]
    );
    const visibleBrandSuggestions = useMemo(
        () =>
            brandSuggestions
                .filter(
                    suggestion =>
                        !items.some(
                            merchant =>
                                merchant.domain === suggestion.domain ||
                                merchant.logoUrl === suggestion.logoUrl
                        )
                )
                .slice(0, 4),
        [brandSuggestions, items]
    );
    const normalizedQuery = query.trim().toLowerCase();
    const canCreate =
        query.trim() !== '' &&
        !items.some(
            merchant =>
                merchant.name.trim().toLowerCase() === normalizedQuery ||
                merchant.displayName.trim().toLowerCase() === normalizedQuery
        );

    async function saveMerchant(formData: FormData) {
        setPending(true);
        setError(null);
        try {
            const merchant = await createMerchantAction(formData);
            setItems(current => {
                const withoutDuplicate = current.filter(
                    item => item.id !== merchant.id
                );
                return [merchant, ...withoutDuplicate];
            });
            setQuery('');
            setBrandSuggestions([]);
            onChange(merchant);
        } catch {
            setError('Could not save merchant.');
        } finally {
            setPending(false);
        }
    }

    async function createMerchant() {
        const name = query.trim();
        if (!name || pending) {
            return;
        }

        const formData = new FormData();
        formData.set('name', name);
        await saveMerchant(formData);
    }

    async function createBrandMerchant(suggestion: MerchantBrandSuggestion) {
        if (pending) {
            return;
        }

        const formData = new FormData();
        formData.set('name', suggestion.name);
        formData.set('brandName', suggestion.name);
        formData.set('domain', suggestion.domain);
        if (suggestion.brandId) {
            formData.set('brandfetchBrandId', suggestion.brandId);
        }
        if (suggestion.logoUrl) {
            formData.set('logoUrl', suggestion.logoUrl);
        }
        await saveMerchant(formData);
    }

    return (
        <Field>
            <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="merchant-search">Merchant</FieldLabel>
                {selected ? (
                    <Button
                        className="h-7 px-2"
                        onClick={() => onChange(undefined)}
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
                    <MerchantLogo merchant={selected} size="sm" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                            {merchantDisplayName(selected)}
                        </p>
                        {selected.domain ? (
                            <p className="truncate text-xs text-muted-foreground">
                                {selected.domain}
                            </p>
                        ) : null}
                    </div>
                </div>
            ) : null}
            <Input
                autoComplete="off"
                id="merchant-search"
                onChange={event => setQuery(event.target.value)}
                placeholder={
                    selected ? 'Search another merchant' : 'Search merchant'
                }
                value={query}
            />
            {query.trim() || !selected ? (
                <div className="flex flex-col gap-1">
                    {visible.map(merchant => (
                        <Button
                            className="h-auto justify-start gap-2 px-2 py-2"
                            key={merchant.id}
                            onClick={() => {
                                setQuery('');
                                onChange(merchant);
                            }}
                            type="button"
                            variant="outline"
                        >
                            <MerchantLogo merchant={merchant} size="sm" />
                            <span className="min-w-0 text-left">
                                <span className="block truncate">
                                    {merchantDisplayName(merchant)}
                                </span>
                                {merchant.suggestedCategoryDisplayName ? (
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {merchant.suggestedCategoryDisplayName}
                                    </span>
                                ) : null}
                            </span>
                        </Button>
                    ))}
                    {visibleBrandSuggestions.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            {visibleBrandSuggestions.map(suggestion => (
                                <Button
                                    className="h-auto justify-start gap-2 px-2 py-2"
                                    disabled={pending}
                                    key={`${suggestion.brandId ?? suggestion.domain}-${suggestion.domain}`}
                                    onClick={() =>
                                        void createBrandMerchant(suggestion)
                                    }
                                    type="button"
                                    variant="outline"
                                >
                                    <MerchantLogo
                                        merchant={{
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
                            onClick={createMerchant}
                            type="button"
                            variant="outline"
                        >
                            <StoreIcon aria-hidden className="size-4" />
                            {pending
                                ? 'Saving merchant...'
                                : `Add ${query.trim()}`}
                        </Button>
                    ) : null}
                    {!canCreate && visible.length === 0 ? (
                        <FieldDescription>
                            No matching merchants.
                        </FieldDescription>
                    ) : null}
                    {brandSearchPending ? (
                        <FieldDescription>Searching brands...</FieldDescription>
                    ) : null}
                    {brandSearchError ? (
                        <FieldDescription>{brandSearchError}</FieldDescription>
                    ) : null}
                </div>
            ) : null}
            {error ? <FieldError role="alert">{error}</FieldError> : null}
        </Field>
    );
}
