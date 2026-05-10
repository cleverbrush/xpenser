'use client';

import { Button, FieldError, Input } from '@xpenser/ui';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { createCategoryAction } from '@/lib/actions';
import { isNextRedirectError } from './form-utils';

type CategoryDraft = {
    readonly id: number;
    readonly name: string;
    readonly type: 'expense' | 'income';
};

let nextId = 1;

function newDraft(type: 'expense' | 'income' = 'expense'): CategoryDraft {
    nextId += 1;
    return { id: nextId, name: '', type };
}

export function CategorySetupForm() {
    const router = useRouter();
    const [rows, setRows] = useState<CategoryDraft[]>([
        newDraft('expense'),
        newDraft('income')
    ]);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    function updateRow(id: number, update: Partial<CategoryDraft>) {
        setRows(current =>
            current.map(row => (row.id === id ? { ...row, ...update } : row))
        );
    }

    function removeRow(id: number) {
        setRows(current =>
            current.length === 1
                ? current
                : current.filter(row => row.id !== id)
        );
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const categories = rows
            .map(row => ({ ...row, name: row.name.trim() }))
            .filter(row => row.name.length > 0);

        if (categories.length === 0) {
            setError('Add at least one category.');
            return;
        }

        setPending(true);
        setError(null);
        try {
            for (const category of categories) {
                const formData = new FormData();
                formData.set('name', category.name);
                formData.set('type', category.type);
                await createCategoryAction(formData);
            }
            router.push('/dashboard');
            router.refresh();
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError('Could not save categories.');
        } finally {
            setPending(false);
        }
    }

    return (
        <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={handleSubmit}
        >
            <div className="flex flex-col gap-3">
                {rows.map((row, index) => (
                    <div
                        className="grid grid-cols-[minmax(0,1fr)_120px_40px] gap-2"
                        key={row.id}
                    >
                        <Input
                            aria-label={`Category ${index + 1} name`}
                            onChange={event =>
                                updateRow(row.id, {
                                    name: event.target.value
                                })
                            }
                            placeholder={index === 0 ? 'Groceries' : 'Salary'}
                            value={row.name}
                        />
                        <select
                            aria-label={`Category ${index + 1} type`}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            onChange={event =>
                                updateRow(row.id, {
                                    type: event.target.value as
                                        | 'expense'
                                        | 'income'
                                })
                            }
                            value={row.type}
                        >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                        </select>
                        <Button
                            aria-label="Remove category"
                            disabled={rows.length === 1 || pending}
                            onClick={() => removeRow(row.id)}
                            size="icon"
                            type="button"
                            variant="ghost"
                        >
                            <Trash2Icon aria-hidden className="size-4" />
                        </Button>
                    </div>
                ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    className="w-full sm:w-auto"
                    disabled={pending}
                    onClick={() => setRows(current => [...current, newDraft()])}
                    type="button"
                    variant="outline"
                >
                    <PlusIcon aria-hidden className="size-4" />
                    Add category
                </Button>
                <Button className="w-full sm:w-auto" disabled={pending}>
                    {pending ? 'Saving...' : 'Create categories'}
                </Button>
            </div>
            {error ? <FieldError role="alert">{error}</FieldError> : null}
        </form>
    );
}
