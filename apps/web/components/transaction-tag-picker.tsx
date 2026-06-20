'use client';

import type { TransactionTag } from '@xpenser/contracts';
import { FieldLimits, TransactionTagLimits } from '@xpenser/contracts';
import {
    Badge,
    Button,
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    Input
} from '@xpenser/ui';
import { PlusIcon, XIcon } from 'lucide-react';
import { type KeyboardEvent, useId, useMemo, useState } from 'react';

function normalizeTagName(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function tagKey(value: string): string {
    return normalizeTagName(value).toLowerCase();
}

function tagMatches(tag: Pick<TransactionTag, 'name'>, query: string): boolean {
    const search = query.trim().toLowerCase();
    return !search || tag.name.toLowerCase().includes(search);
}

export function TransactionTagPicker({
    tags,
    selectedTags,
    onChange,
    label = 'Tags'
}: {
    readonly tags: readonly TransactionTag[];
    readonly selectedTags: readonly string[];
    readonly onChange: (tags: readonly string[]) => void;
    readonly label?: string;
}) {
    const inputId = useId();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const selectedKeys = useMemo(
        () => new Set(selectedTags.map(tagKey)),
        [selectedTags]
    );
    const availableKeys = useMemo(
        () => new Set(tags.map(tag => tagKey(tag.name))),
        [tags]
    );
    const visible = useMemo(
        () =>
            tags
                .filter(tag => !selectedKeys.has(tagKey(tag.name)))
                .filter(tag => tagMatches(tag, query))
                .slice(0, 8),
        [query, selectedKeys, tags]
    );
    const normalizedQuery = normalizeTagName(query);
    const canCreate =
        normalizedQuery !== '' &&
        !selectedKeys.has(tagKey(normalizedQuery)) &&
        !availableKeys.has(tagKey(normalizedQuery));

    function addTag(name: string) {
        const normalized = normalizeTagName(name);
        if (!normalized) {
            setError('Enter a tag name.');
            return;
        }
        if (normalized.length > FieldLimits.transactionTagName) {
            setError('Tag name is too long.');
            return;
        }
        if (selectedKeys.has(tagKey(normalized))) {
            setQuery('');
            setOpen(false);
            setError(null);
            return;
        }
        if (selectedTags.length >= TransactionTagLimits.maxTagsPerTransaction) {
            setError(
                `Use up to ${TransactionTagLimits.maxTagsPerTransaction} tags.`
            );
            return;
        }

        onChange([...selectedTags, normalized]);
        setQuery('');
        setOpen(false);
        setError(null);
    }

    function removeTag(name: string) {
        const removeKey = tagKey(name);
        onChange(selectedTags.filter(tag => tagKey(tag) !== removeKey));
        setError(null);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key !== 'Enter' && event.key !== ',') {
            return;
        }

        event.preventDefault();
        if (normalizedQuery) {
            addTag(normalizedQuery);
        }
    }

    return (
        <Field>
            <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
            {selectedTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {selectedTags.map(tag => (
                        <Badge
                            className="gap-1 pr-1"
                            key={tagKey(tag)}
                            variant="secondary"
                        >
                            <span>{tag}</span>
                            <button
                                aria-label={`Remove tag ${tag}`}
                                className="rounded-sm p-0.5 hover:bg-background/70"
                                onClick={() => removeTag(tag)}
                                type="button"
                            >
                                <XIcon aria-hidden className="size-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            ) : null}
            <div className="relative">
                <Input
                    autoComplete="off"
                    id={inputId}
                    maxLength={FieldLimits.transactionTagName}
                    onBlur={() => {
                        setTimeout(() => setOpen(false), 100);
                    }}
                    onChange={event => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add tag"
                    value={query}
                />
                {open ? (
                    <div className="absolute z-20 mt-1 flex max-h-64 w-full flex-col gap-1 overflow-auto rounded-md border bg-popover p-1 shadow-md">
                        {visible.map(tag => (
                            <Button
                                className="h-auto justify-start px-2 py-2"
                                key={tag.id}
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => addTag(tag.name)}
                                type="button"
                                variant="ghost"
                            >
                                {tag.name}
                            </Button>
                        ))}
                        {canCreate ? (
                            <Button
                                className="justify-start gap-2"
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => addTag(normalizedQuery)}
                                type="button"
                                variant="ghost"
                            >
                                <PlusIcon aria-hidden className="size-4" />
                                Add {normalizedQuery}
                            </Button>
                        ) : null}
                        {!canCreate && visible.length === 0 ? (
                            <FieldDescription className="px-2 py-1.5">
                                No matching tags.
                            </FieldDescription>
                        ) : null}
                    </div>
                ) : null}
            </div>
            {error ? <FieldError role="alert">{error}</FieldError> : null}
        </Field>
    );
}
