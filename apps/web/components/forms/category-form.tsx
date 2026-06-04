'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import { type Category, CreateCategoryBodySchema } from '@xpenser/contracts';
import {
    Button,
    type CheckboxRendererFieldProps,
    FieldError,
    FieldGroup,
    type SelectRendererFieldProps
} from '@xpenser/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
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
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [formVersion, setFormVersion] = useState(0);
    const [selectedType, setSelectedType] = useState<Category['type']>(
        initialCategory?.type ?? 'expense'
    );
    const [selectedParentId, setSelectedParentId] = useState<number | null>(
        initialCategory?.parentId ?? null
    );
    const [selectedKind, setSelectedKind] = useState<Category['kind']>(
        initialCategory?.kind ?? 'normal'
    );
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
        setSelectedType(nextType);
        setSelectedParentId(nextParentId);
        setSelectedKind(nextKind);
        setFormVersion(version => version + 1);
    }, [form, initialCategory, initialValues]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        form.setValue({
            type: selectedType,
            parentId: selectedParentId,
            kind: selectedParentId ? selectedKind : 'normal'
        });
        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        setPending(true);
        setError(null);
        try {
            const formData = valuesToFormData(result.object);
            if (first) {
                await createFirstCategoryAction(formData);
            } else if (initialCategory) {
                formData.set('id', String(initialCategory.id));
                await updateCategoryAction(formData);
                router.refresh();
                onSaved?.();
            } else {
                const category = await createCategoryAction(formData);
                form.reset({ type: 'expense', parentId: null, kind: 'normal' });
                router.refresh();
                onSaved?.(category);
            }
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError('Could not save the category.');
        } finally {
            setPending(false);
        }
    }

    return (
        <form data-testid="category-form" noValidate onSubmit={handleSubmit}>
            <FieldGroup key={formVersion}>
                <SchemaField
                    fieldProps={{ placeholder: namePlaceholder }}
                    forProperty={field => field.name}
                    form={form}
                    label="Name"
                    name="name"
                />
                <SchemaField
                    fieldProps={
                        {
                            disabled: structuralDisabled,
                            onValueChange: (value, field) => {
                                if (value === 'expense' || value === 'income') {
                                    field.onChange(value);
                                    setSelectedType(value);
                                    setSelectedParentId(null);
                                    setSelectedKind('normal');
                                    form.setValue({
                                        parentId: null,
                                        kind: 'normal'
                                    });
                                }
                            },
                            options: [
                                { label: 'Expense', value: 'expense' },
                                { label: 'Income', value: 'income' }
                            ],
                            value: selectedType
                        } satisfies SelectRendererFieldProps
                    }
                    forProperty={field => field.type}
                    form={form}
                    label="Type"
                    variant="select"
                />
                {!first ? (
                    <>
                        <SchemaField
                            fieldProps={
                                {
                                    ariaLabel: 'Parent category',
                                    disabled: structuralDisabled,
                                    onValueChange: (value, field) => {
                                        const nextParentId =
                                            value === 'none'
                                                ? null
                                                : Number(value);
                                        field.onChange(nextParentId);
                                        setSelectedParentId(nextParentId);
                                        if (nextParentId === null) {
                                            setSelectedKind('normal');
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
                                } satisfies SelectRendererFieldProps
                            }
                            forProperty={field => field.parentId}
                            form={form}
                            label="Parent"
                            variant="select"
                        />
                        <SchemaField
                            fieldProps={
                                {
                                    checked:
                                        selectedParentId !== null &&
                                        selectedKind === 'offset',
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
                                        setSelectedKind(nextKind);
                                    }
                                } satisfies CheckboxRendererFieldProps
                            }
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
