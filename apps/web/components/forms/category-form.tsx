'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import { CreateCategoryBodySchema } from '@xpenser/contracts';
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
import { createCategoryAction, createFirstCategoryAction } from '@/lib/actions';
import { isNextRedirectError, valuesToFormData } from './form-utils';

export function CategoryForm({
    first = false,
    namePlaceholder,
    submitLabel = 'Create category'
}: {
    readonly first?: boolean;
    readonly namePlaceholder?: string;
    readonly submitLabel?: string;
}) {
    const form = useSchemaForm(CreateCategoryBodySchema);
    const type = form.useField(field => field.type);
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const typeInvalid = type.touched && Boolean(type.error);

    useEffect(() => {
        form.reset({ type: 'expense' });
    }, [form]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

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
            } else {
                await createCategoryAction(formData);
                form.reset({ type: 'expense' });
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
                        onValueChange={type.onChange}
                        value={type.value ?? 'expense'}
                    >
                        <SelectTrigger
                            aria-invalid={typeInvalid}
                            aria-label="Category type"
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
                {error ? <FieldError role="alert">{error}</FieldError> : null}
                <Button className="w-full" disabled={pending} type="submit">
                    {pending ? 'Saving...' : submitLabel}
                </Button>
            </FieldGroup>
        </form>
    );
}
