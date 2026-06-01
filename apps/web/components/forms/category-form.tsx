'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import { type Category, CreateCategoryBodySchema } from '@xpenser/contracts';
import {
    Button,
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
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
    namePlaceholder,
    onSaved,
    submitLabel = initialCategory ? 'Save category' : 'Create category'
}: {
    readonly categories?: readonly Category[];
    readonly first?: boolean;
    readonly initialCategory?: Category;
    readonly namePlaceholder?: string;
    readonly onSaved?: () => void;
    readonly submitLabel?: string;
}) {
    const form = useSchemaForm(CreateCategoryBodySchema);
    const type = form.useField(field => field.type);
    const parentId = form.useField(field => field.parentId);
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [selectedKind, setSelectedKind] = useState<Category['kind']>(
        initialCategory?.kind ?? 'normal'
    );
    const selectedType = type.value ?? initialCategory?.type ?? 'expense';
    const selectedParentId =
        parentId.value ?? initialCategory?.parentId ?? null;
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
    const typeInvalid = type.touched && Boolean(type.error);

    useEffect(() => {
        form.reset({
            name: initialCategory?.name,
            type: initialCategory?.type ?? 'expense',
            parentId: initialCategory?.parentId ?? null,
            kind: initialCategory?.kind ?? 'normal'
        });
        setSelectedKind(initialCategory?.kind ?? 'normal');
    }, [form, initialCategory]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        form.setValue({
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
                await createCategoryAction(formData);
                form.reset({ type: 'expense', parentId: null, kind: 'normal' });
                router.refresh();
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
            <FieldGroup>
                <SchemaField
                    fieldProps={{ placeholder: namePlaceholder }}
                    forProperty={field => field.name}
                    form={form}
                    label="Name"
                    name="name"
                />
                <Field data-invalid={typeInvalid ? true : undefined}>
                    <FieldLabel>Type</FieldLabel>
                    <Select
                        onOpenChange={open => {
                            if (!open) {
                                type.onBlur();
                            }
                        }}
                        onValueChange={value => {
                            if (value === 'expense' || value === 'income') {
                                type.onChange(value);
                            }
                            parentId.onChange(null);
                            setSelectedKind('normal');
                        }}
                        value={type.value ?? 'expense'}
                    >
                        <SelectTrigger
                            aria-invalid={typeInvalid}
                            aria-label="Category type"
                            disabled={structuralDisabled}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="expense">Expense</SelectItem>
                                <SelectItem value="income">Income</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {type.touched && type.error ? (
                        <FieldError>{type.error}</FieldError>
                    ) : null}
                </Field>
                {!first ? (
                    <>
                        <Field>
                            <FieldLabel>Parent</FieldLabel>
                            <Select
                                disabled={structuralDisabled}
                                onValueChange={value => {
                                    const nextParentId =
                                        value === 'none' ? null : Number(value);
                                    parentId.onChange(nextParentId);
                                    if (nextParentId === null) {
                                        setSelectedKind('normal');
                                    }
                                }}
                                value={
                                    selectedParentId === null
                                        ? 'none'
                                        : String(selectedParentId)
                                }
                            >
                                <SelectTrigger aria-label="Parent category">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="none">
                                            No parent
                                        </SelectItem>
                                        {parentOptions.map(category => (
                                            <SelectItem
                                                key={category.id}
                                                value={String(category.id)}
                                            >
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field>
                            <FieldLabel>Child behavior</FieldLabel>
                            <Select
                                disabled={
                                    structuralDisabled ||
                                    selectedParentId === null
                                }
                                onValueChange={value =>
                                    setSelectedKind(
                                        value === 'offset' ? 'offset' : 'normal'
                                    )
                                }
                                value={
                                    selectedParentId === null
                                        ? 'normal'
                                        : selectedKind
                                }
                            >
                                <SelectTrigger aria-label="Child behavior">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="normal">
                                            Same direction
                                        </SelectItem>
                                        <SelectItem value="offset">
                                            {offsetKindLabel}
                                        </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>
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
