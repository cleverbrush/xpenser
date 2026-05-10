'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
import {
    type Currency,
    UpdateUserPreferenceBodySchema,
    type UserPreference
} from '@xpenser/contracts';
import {
    Button,
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
    Input,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@xpenser/ui';
import { type FormEvent, useEffect, useState } from 'react';
import { updatePreferencesAction } from '@/lib/actions';
import { isNextRedirectError, valuesToFormData } from './form-utils';

export function PreferencesForm({
    me,
    currencies,
    topCurrencies
}: {
    readonly me: UserPreference;
    readonly currencies: readonly Currency[];
    readonly topCurrencies: readonly Currency[];
}) {
    const form = useSchemaForm(UpdateUserPreferenceBodySchema);
    const defaultCurrency = form.useField(field => field.defaultCurrency);
    const favoriteCurrencies = form.useField(field => field.favoriteCurrencies);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const selectedFavoriteCurrencies =
        favoriteCurrencies.value ?? me.favoriteCurrencies;
    const defaultCurrencyInvalid =
        defaultCurrency.touched && Boolean(defaultCurrency.error);
    const favoriteCurrenciesInvalid =
        favoriteCurrencies.touched && Boolean(favoriteCurrencies.error);

    useEffect(() => {
        form.reset({
            defaultCurrency: me.defaultCurrency,
            favoriteCurrencies: [...me.favoriteCurrencies]
        });
    }, [form, me.defaultCurrency, me.favoriteCurrencies]);

    function toggleFavoriteCurrency(code: string, checked: boolean) {
        const nextValues = checked
            ? Array.from(new Set([...selectedFavoriteCurrencies, code]))
            : selectedFavoriteCurrencies.filter(value => value !== code);

        favoriteCurrencies.onChange(nextValues);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        setPending(true);
        setError(null);
        try {
            await updatePreferencesAction(valuesToFormData(result.object));
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError('Could not save preferences.');
        } finally {
            setPending(false);
        }
    }

    return (
        <form noValidate onSubmit={handleSubmit}>
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" readOnly value={me.email} />
                </Field>
                <Field data-invalid={defaultCurrencyInvalid ? true : undefined}>
                    <FieldLabel>Default currency</FieldLabel>
                    <Select
                        onOpenChange={open => {
                            if (!open) {
                                defaultCurrency.onBlur();
                            }
                        }}
                        onValueChange={defaultCurrency.onChange}
                        value={defaultCurrency.value ?? me.defaultCurrency}
                    >
                        <SelectTrigger aria-invalid={defaultCurrencyInvalid}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {currencies.map(currency => (
                                    <SelectItem
                                        key={currency.code}
                                        value={currency.code}
                                    >
                                        {currency.code} - {currency.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {defaultCurrency.touched && defaultCurrency.error ? (
                        <FieldError>{defaultCurrency.error}</FieldError>
                    ) : null}
                </Field>
                <FieldSet
                    data-invalid={favoriteCurrenciesInvalid ? true : undefined}
                >
                    <FieldLegend>Favorite currencies</FieldLegend>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {topCurrencies.map(currency => (
                            <label
                                className="flex items-center gap-2 text-sm"
                                key={currency.code}
                            >
                                <input
                                    checked={selectedFavoriteCurrencies.includes(
                                        currency.code
                                    )}
                                    name="favoriteCurrencies"
                                    onBlur={favoriteCurrencies.onBlur}
                                    onChange={event =>
                                        toggleFavoriteCurrency(
                                            currency.code,
                                            event.target.checked
                                        )
                                    }
                                    type="checkbox"
                                    value={currency.code}
                                />
                                {currency.code}
                            </label>
                        ))}
                    </div>
                    {favoriteCurrencies.touched && favoriteCurrencies.error ? (
                        <FieldError>{favoriteCurrencies.error}</FieldError>
                    ) : null}
                </FieldSet>
                {error ? <FieldError role="alert">{error}</FieldError> : null}
                <Button
                    className="w-full sm:w-auto"
                    disabled={pending}
                    type="submit"
                >
                    {pending ? 'Saving...' : 'Save preferences'}
                </Button>
            </FieldGroup>
        </form>
    );
}
