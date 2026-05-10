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
import { CurrencyMultiSelect } from './currency-multi-select';
import { isNextRedirectError, valuesToFormData } from './form-utils';

export function PreferencesForm({
    me,
    currencies
}: {
    readonly me: UserPreference;
    readonly currencies: readonly Currency[];
}) {
    const form = useSchemaForm(UpdateUserPreferenceBodySchema);
    const defaultCurrency = form.useField(field => field.defaultCurrency);
    const favoriteCurrencies = form.useField(field => field.favoriteCurrencies);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const selectedDefaultCurrency = defaultCurrency.value ?? me.defaultCurrency;
    const selectedFavoriteCurrencies = (
        favoriteCurrencies.value ?? me.favoriteCurrencies
    ).filter(currency => currency !== selectedDefaultCurrency);
    const defaultCurrencyInvalid =
        defaultCurrency.touched && Boolean(defaultCurrency.error);

    useEffect(() => {
        form.reset({
            defaultCurrency: me.defaultCurrency,
            favoriteCurrencies: me.favoriteCurrencies.filter(
                currency => currency !== me.defaultCurrency
            )
        });
    }, [form, me.defaultCurrency, me.favoriteCurrencies]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const favoriteCurrencies = selectedFavoriteCurrencies.filter(
            currency => currency !== selectedDefaultCurrency
        );
        form.setValue({ favoriteCurrencies });
        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        setPending(true);
        setError(null);
        try {
            await updatePreferencesAction(
                valuesToFormData({ ...result.object, favoriteCurrencies })
            );
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
                        onValueChange={value => {
                            defaultCurrency.onChange(value);
                            favoriteCurrencies.onChange(
                                selectedFavoriteCurrencies.filter(
                                    currency => currency !== value
                                )
                            );
                        }}
                        value={selectedDefaultCurrency}
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
                <CurrencyMultiSelect
                    currencies={currencies}
                    error={favoriteCurrencies.error}
                    excludedCurrency={selectedDefaultCurrency}
                    onBlur={favoriteCurrencies.onBlur}
                    onChange={values => favoriteCurrencies.onChange(values)}
                    selectedCurrencies={selectedFavoriteCurrencies}
                    touched={favoriteCurrencies.touched}
                />
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
