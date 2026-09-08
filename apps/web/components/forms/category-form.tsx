'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
import { type Category, CreateCategoryBodySchema } from '@xpenser/contracts';
import { Button, FieldError, FieldGroup } from '@xpenser/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SchemaField } from '@/components/forms/schema-fields';
import {
    createCategoryAction,
    createFirstCategoryAction,
    updateCategoryAction
} from '@/lib/actions';
import { isNextRedirectError, valuesToFormData } from './form-utils';

export function CategoryForm({
    categories = [],
    first = false,
    initialCategory,
    initialValues,
    namePlaceholder,
    onSaved,
    submitLabel = initialCategory ? 'Save category' : 'Create category'
}: {
    readonly categories?: readonly Category[];
    readonly first?: boolean;
    readonly initialCategory?: Category;
    readonly initialValues?: Pick<
        Category,
        'kind' | 'name' | 'parentId' | 'type'
    >;
    readonly namePlaceholder?: string;
    readonly onSaved?: (category?: Category) => void;
    readonly submitLabel?: string;
}) {
    const form = useSchemaForm(CreateCategoryBodySchema);
    const router = useRouter();
    const { submitting: pending, error } = form;
    const type = form.useField(field => field.type);
    const parentId = form.useField(field => field.parentId);
    const kind = form.useField(field => field.kind);
    const selectedType = type.value ?? 'expense';
    const selectedParentId = parentId.value ?? null;
    const structuralDisabled =
        Boolean(initialCategory?.inUse) ||
        Boolean(initialCategory?.hasChildren);
    const parentOptions = categories.filter(
        category =>
            category.id !== initialCategory?.id &&
            !category.parentId &&
            category.type === selectedType
    );
    const offsetKindLabel = selectedType === 'expense' ? 'Return' : 'Expense';

    useEffect(() => {
        const nextType =
            initialCategory?.type ?? initialValues?.type ?? 'expense';
        const nextParentId =
            initialCategory?.parentId ?? initialValues?.parentId ?? null;
        const nextKind =
            initialCategory?.kind ?? initialValues?.kind ?? 'normal';

        form.reset({
            name: initialCategory?.name ?? initialValues?.name,
            type: nextType,
            parentId: nextParentId,
            kind: nextKind
        });
    }, [form, initialCategory, initialValues]);

    const handleSubmit = form.handleSubmit<Category | undefined>(
        async values => {
            const formData = valuesToFormData(values);
            if (first) {
                await createFirstCategoryAction(formData);
            } else if (initialCategory) {
                formData.set('id', String(initialCategory.id));
                await updateCategoryAction(formData);
            } else {
                return { ok: true, data: await createCategoryAction(formData) };
            }
            return { ok: true };
        },
        {
            onSuccess: category => {
                if (first) return;
                if (!initialCategory)
                    form.reset({
                        type: 'expense',
                        parentId: null,
                        kind: 'normal'
                    });
                router.refresh();
                onSaved?.(category);
            },
            onError: caught => {
                if (isNextRedirectError(caught)) throw caught;
                return 'Could not save the category.';
            }
        }
    );

    return (
        <form data-testid="category-form" noValidate onSubmit={handleSubmit}>
            <FieldGroup>
                <SchemaField
                    fieldProps={{ placeholder: namePlaceholder }}
                    forProperty={field => field.name}
                    form={form}
                    label="Name"
                    name="name"
                />
                <SchemaField
                    fieldProps={{
                        disabled: structuralDisabled,
                        onValueChange: (value, field) => {
                            if (value === 'expense' || value === 'income') {
                                field.onChange(value);
                                form.setValue({
                                    parentId: null,
                                    kind: 'normal'
                                });
                            }
                        },
                        options: [
                            { label: 'Expense', value: 'expense' },
                            { label: 'Income', value: 'income' }
                        ]
                    }}
                    forProperty={field => field.type}
                    form={form}
                    label="Type"
                    variant="select"
                />
                {!first ? (
                    <>
                        <SchemaField
                            fieldProps={{
                                ariaLabel: 'Parent category',
                                disabled: structuralDisabled,
                                onValueChange: (value, field) => {
                                    const nextParentId =
                                        value === 'none' ? null : Number(value);
                                    field.onChange(nextParentId);
                                    if (nextParentId === null) {
                                        form.setValue({ kind: 'normal' });
                                    }
                                },
                                options: [
                                    { label: 'No parent', value: 'none' },
                                    ...parentOptions.map(category => ({
                                        label: category.name,
                                        value: String(category.id)
                                    }))
                                ],
                                value:
                                    selectedParentId === null
                                        ? 'none'
                                        : String(selectedParentId)
                            }}
                            forProperty={field => field.parentId}
                            form={form}
                            label="Parent"
                            variant="select"
                        />
                        <SchemaField
                            fieldProps={{
                                checked:
                                    selectedParentId !== null &&
                                    kind.value === 'offset',
                                description:
                                    selectedParentId === null
                                        ? 'Select a parent category first.'
                                        : `Report transactions as ${offsetKindLabel.toLowerCase()}.`,
                                disabled:
                                    structuralDisabled ||
                                    selectedParentId === null,
                                onCheckedChange: (checked, field) => {
                                    const nextKind = checked
                                        ? 'offset'
                                        : 'normal';
                                    field.onChange(nextKind);
                                }
                            }}
                            forProperty={field => field.kind}
                            form={form}
                            label="Reverse direction"
                            variant="checkbox"
                        />
                    </>
                ) : null}
                {error ? <FieldError role="alert">{error}</FieldError> : null}
                <Button className="w-full" disabled={pending} type="submit">
                    {pending ? 'Saving...' : submitLabel}
                </Button>
            </FieldGroup>
        </form>
    );
}
