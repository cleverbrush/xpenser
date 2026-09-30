'use client';

import {
    type SchemaFormInstance,
    useSchemaForm
} from '@cleverbrush/react-form';
import { array, number, object, string } from '@cleverbrush/schema';
import { CreateCategoryBodySchema, FieldLimits } from '@xpenser/contracts';
import { Button, Field, FieldError, FieldGroup, FieldLabel } from '@xpenser/ui';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createCategoryAction } from '@/lib/actions';
import { mapFormIssues } from '@/lib/form-result';
import { valuesToFormData } from './form-utils';
import { SchemaField } from './schema-fields';
import { submissionError } from './submission-error';

// Blank rows are intentional UI drafts; the API schema validates populated rows.
const DraftSchema = CreateCategoryBodySchema.pick(['name', 'type'])
    .modifyPropSchema('name', () =>
        string().trim().maxLength(FieldLimits.categoryName)
    )
    .addProp('id', number());
const SetupSchema = object({ rows: array(DraftSchema) });

function CategoryTypeField({
    form,
    index,
    id,
    disabled
}: {
    form: SchemaFormInstance<typeof SetupSchema>;
    index: number;
    id: number;
    disabled: boolean;
}) {
    const field = form.useField(t => t.rows[index]!.type);
    const inputId = 'category-' + id + '-type';
    return (
        <Field data-invalid={field.touched && Boolean(field.error)}>
            <FieldLabel htmlFor={inputId}>
                {'Category ' + (index + 1) + ' type'}
            </FieldLabel>
            <select
                id={inputId}
                disabled={disabled}
                className="h-10 rounded-md border bg-background px-3"
                value={field.value ?? 'expense'}
                onBlur={field.onBlur}
                aria-invalid={field.touched && Boolean(field.error)}
                aria-describedby={field.error ? inputId + '-error' : undefined}
                onChange={event =>
                    field.onChange(
                        event.target.value === 'income' ? 'income' : 'expense'
                    )
                }
            >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
            </select>
            {field.touched && field.error ? (
                <FieldError id={inputId + '-error'}>{field.error}</FieldError>
            ) : null}
        </Field>
    );
}

export function CategorySetupForm() {
    const router = useRouter();
    const form = useSchemaForm(SetupSchema);
    const rows = form.useField(t => t.rows);
    const nextId = useRef(2);
    const completed = useRef(new Set<number>());
    const [savedIds, setSavedIds] = useState<ReadonlySet<number>>(new Set());
    useEffect(() => {
        form.reset({
            rows: [
                { id: 0, name: '', type: 'expense' },
                { id: 1, name: '', type: 'income' }
            ]
        });
    }, [form]);
    const pending = form.submitting;
    const values = rows.value ?? [];
    const handleSubmit = form.handleSubmit(
        async submitted => {
            const populated = submitted.rows
                .map((row, index) => ({ row, index }))
                .filter(({ row }) => row.name.trim());
            if (!populated.length)
                return { ok: false, error: 'Add at least one category.' };
            for (const { row, index } of populated) {
                if (completed.current.has(row.id)) continue;
                const result = await createCategoryAction(
                    valuesToFormData({ name: row.name, type: row.type })
                );
                if (!result.ok)
                    return mapFormIssues(result, pointer =>
                        pointer ? '/rows/' + index + pointer : ''
                    );
                completed.current.add(row.id);
                setSavedIds(new Set(completed.current));
            }
            return { ok: true };
        },
        {
            onSuccess: () => {
                router.push('/dashboard');
                router.refresh();
            },
            onError: submissionError('Could not save categories.')
        }
    );

    return (
        <form
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
        >
            <FieldGroup>
                {values.map((row, index) => (
                    <FieldGroup
                        key={row.id}
                        className="sm:grid sm:grid-cols-[minmax(0,1fr)_120px_40px]"
                    >
                        <SchemaField
                            form={form}
                            forProperty={t => t.rows[index]!.name}
                            name={'category-' + row.id + '-name'}
                            label={'Category ' + (index + 1) + ' name'}
                            fieldProps={{
                                disabled: pending || savedIds.has(row.id),
                                placeholder:
                                    index === 0 ? 'Groceries' : 'Salary'
                            }}
                        />
                        <CategoryTypeField
                            form={form}
                            index={index}
                            id={row.id}
                            disabled={pending || savedIds.has(row.id)}
                        />
                        {savedIds.has(row.id) ? (
                            <span>Saved</span>
                        ) : (
                            <Button
                                aria-label="Remove category"
                                disabled={pending || values.length === 1}
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                    rows.onChange(
                                        values.filter(
                                            value => value.id !== row.id
                                        )
                                    )
                                }
                            >
                                <Trash2Icon data-icon="inline-start" />
                            </Button>
                        )}
                    </FieldGroup>
                ))}
            </FieldGroup>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    disabled={pending}
                    type="button"
                    variant="outline"
                    onClick={() =>
                        rows.onChange([
                            ...values,
                            { id: nextId.current++, name: '', type: 'expense' }
                        ])
                    }
                >
                    <PlusIcon data-icon="inline-start" /> Add category
                </Button>
                <Button disabled={pending} type="submit">
                    {pending ? 'Saving...' : 'Create categories'}
                </Button>
            </div>
            {form.error ? (
                <FieldError role="alert">{form.error}</FieldError>
            ) : null}
        </form>
    );
}
