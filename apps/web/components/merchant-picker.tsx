'use client';

import type { Merchant } from '@xpenser/contracts';
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
import { createMerchantAction } from '@/lib/actions';

function merchantLabel(merchant: Merchant): string {
    return merchant.displayName || merchant.brandName || merchant.name;
}

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

function MerchantLogo({ merchant }: { readonly merchant: Merchant }) {
    const label = merchantLabel(merchant);
    if (merchant.logoUrl) {
        return (
            <span
                aria-hidden
                className="size-6 rounded-sm bg-contain bg-center bg-no-repeat"
                style={{
                    backgroundImage: `url(${JSON.stringify(merchant.logoUrl)})`
                }}
            />
        );
    }

    return (
        <span className="flex size-6 items-center justify-center rounded-sm bg-muted text-xs font-medium">
            {label.slice(0, 1).toUpperCase()}
        </span>
    );
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
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setItems(merchants);
    }, [merchants]);

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
    const normalizedQuery = query.trim().toLowerCase();
    const canCreate =
        query.trim() !== '' &&
        !items.some(
            merchant =>
                merchant.name.trim().toLowerCase() === normalizedQuery ||
                merchant.displayName.trim().toLowerCase() === normalizedQuery
        );

    async function createMerchant() {
        const name = query.trim();
        if (!name) {
            return;
        }

        const formData = new FormData();
        formData.set('name', name);
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
            onChange(merchant);
        } catch {
            setError('Could not save merchant.');
        } finally {
            setPending(false);
        }
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
                    <MerchantLogo merchant={selected} />
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                            {merchantLabel(selected)}
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
                            <MerchantLogo merchant={merchant} />
                            <span className="min-w-0 text-left">
                                <span className="block truncate">
                                    {merchantLabel(merchant)}
                                </span>
                                {merchant.suggestedCategoryDisplayName ? (
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {merchant.suggestedCategoryDisplayName}
                                    </span>
                                ) : null}
                            </span>
                        </Button>
                    ))}
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
                </div>
            ) : null}
            {error ? <FieldError role="alert">{error}</FieldError> : null}
        </Field>
    );
}
