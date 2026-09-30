'use client';

import { type UseFieldResult, useSchemaForm } from '@cleverbrush/react-form';
import {
    AcceptBudgetInvitationBodySchema,
    type Budget,
    type BudgetMember,
    CreateBudgetBodySchema,
    type Currency,
    InviteBudgetMemberBodySchema,
    UpdateBudgetBodySchema
} from '@xpenser/contracts';
import {
    Button,
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet
} from '@xpenser/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
    acceptBudgetInvitationAction,
    createBudgetAction,
    inviteBudgetMemberAction,
    updateBudgetAction,
    updateBudgetMemberAction
} from '@/lib/actions';
import {
    defaultMemberPermissions,
    permissionOptions
} from '@/lib/budget-permissions';
import { CurrencyMultiSelect } from './currency-multi-select';
import { valuesToFormData } from './form-utils';
import { SchemaField } from './schema-fields';
import { submissionError } from './submission-error';

const RenameBudgetSchema = UpdateBudgetBodySchema.modifyPropSchema(
    'name',
    schema => schema.required()
);

function CurrencyFields({
    currencies,
    primary,
    favorites,
    id
}: {
    currencies: readonly Currency[];
    primary: UseFieldResult<string | undefined>;
    favorites: Pick<
        UseFieldResult<string[] | undefined>,
        'value' | 'error' | 'touched' | 'onBlur'
    > & { onChange(value: string[]): void };
    id: string;
}) {
    return (
        <>
            <Field data-invalid={primary.touched && Boolean(primary.error)}>
                <FieldLabel htmlFor={id}>Primary</FieldLabel>
                <select
                    id={id}
                    name="defaultCurrency"
                    className="h-10 rounded-md border bg-background px-3"
                    aria-invalid={primary.touched && Boolean(primary.error)}
                    aria-describedby={primary.error ? id + '-error' : undefined}
                    value={primary.value ?? ''}
                    onBlur={primary.onBlur}
                    onChange={event => {
                        primary.onChange(event.target.value);
                        favorites.onChange(
                            (favorites.value ?? []).filter(
                                code => code !== event.target.value
                            )
                        );
                    }}
                >
                    {currencies.map(currency => (
                        <option key={currency.code} value={currency.code}>
                            {currency.code}
                        </option>
                    ))}
                </select>
                {primary.touched && primary.error ? (
                    <FieldError id={id + '-error'}>{primary.error}</FieldError>
                ) : null}
            </Field>
            <CurrencyMultiSelect
                currencies={currencies}
                excludedCurrency={primary.value}
                error={favorites.error}
                touched={favorites.touched}
                selectedCurrencies={favorites.value ?? []}
                onBlur={favorites.onBlur}
                onChange={favorites.onChange}
            />
        </>
    );
}

export function BudgetCreateForm({
    currencies,
    defaultCurrency
}: {
    currencies: readonly Currency[];
    defaultCurrency: string;
}) {
    const form = useSchemaForm(CreateBudgetBodySchema);
    const primary = form.useField(t => t.defaultCurrency);
    const favorites = form.useField(t => t.favoriteCurrencies);
    useEffect(() => {
        form.reset({ name: '', defaultCurrency, favoriteCurrencies: [] });
    }, [form, defaultCurrency]);
    return (
        <form
            noValidate
            onSubmit={form.handleSubmit(
                values => createBudgetAction(valuesToFormData(values)),
                {
                    onError: submissionError('Could not create budget.')
                }
            )}
        >
            <FieldGroup>
                <SchemaField
                    form={form}
                    forProperty={t => t.name}
                    label="Name"
                    name="new-budget-name"
                    fieldProps={{ placeholder: 'Shared household' }}
                />
                <CurrencyFields
                    currencies={currencies}
                    primary={primary}
                    favorites={favorites}
                    id="new-budget-currency"
                />
                {form.error ? (
                    <FieldError role="alert">{form.error}</FieldError>
                ) : null}
                <Button disabled={form.submitting} type="submit">
                    {form.submitting ? 'Creating...' : 'Create'}
                </Button>
            </FieldGroup>
        </form>
    );
}

export function BudgetEditForm({
    budget,
    currencies
}: {
    budget: Budget;
    currencies?: readonly Currency[];
}) {
    const form = useSchemaForm(
        currencies ? UpdateBudgetBodySchema : RenameBudgetSchema
    );
    const router = useRouter();
    const primary = form.useField(t => t.defaultCurrency);
    const favorites = form.useField(t => t.favoriteCurrencies);
    useEffect(() => {
        form.reset(
            currencies
                ? {
                      defaultCurrency: budget.defaultCurrency,
                      favoriteCurrencies: [...budget.favoriteCurrencies]
                  }
                : { name: budget.name }
        );
    }, [form, budget, currencies]);
    return (
        <form
            noValidate
            onSubmit={form.handleSubmit(
                values =>
                    updateBudgetAction(
                        valuesToFormData({ ...values, budgetId: budget.id })
                    ),
                {
                    onSuccess: () => router.refresh(),
                    onError: submissionError('Could not save budget.')
                }
            )}
        >
            <FieldGroup>
                {currencies ? (
                    <CurrencyFields
                        currencies={currencies}
                        primary={primary}
                        favorites={favorites}
                        id={'budget-currency-' + budget.id}
                    />
                ) : (
                    <SchemaField
                        form={form}
                        forProperty={t => t.name}
                        label="My budget name"
                        name="budget-name"
                    />
                )}
                {form.error ? (
                    <FieldError role="alert">{form.error}</FieldError>
                ) : null}
                <Button disabled={form.submitting} type="submit">
                    {form.submitting
                        ? 'Saving...'
                        : currencies
                          ? 'Save currencies'
                          : 'Rename'}
                </Button>
            </FieldGroup>
        </form>
    );
}

export function BudgetMemberForm({
    budgetId,
    member
}: {
    budgetId: number;
    member?: Pick<BudgetMember, 'email' | 'role' | 'permissions' | 'userId'>;
}) {
    const form = useSchemaForm(InviteBudgetMemberBodySchema);
    const router = useRouter();
    useEffect(() => {
        form.reset({
            email: member?.email ?? '',
            role: member?.role ?? 'member',
            permissions: member?.permissions ?? {
                canCreateTransactions: true,
                canUpdateTransactions: false,
                canDeleteTransactions: false,
                canManageCategories: false,
                canManageVendors: false,
                canManageTags: false,
                canManageMembers: false
            }
        });
    }, [form, member]);
    const prefix = member ? 'member-' + member.userId : 'invite';
    return (
        <form
            noValidate
            onSubmit={form.handleSubmit(
                values => {
                    // The API has a nested permissions object; HTML transport retains the existing checkbox keys.
                    const data = valuesToFormData({
                        ...values,
                        ...values.permissions,
                        permissions: undefined,
                        budgetId,
                        userId: member?.userId
                    });
                    return member
                        ? updateBudgetMemberAction(data)
                        : inviteBudgetMemberAction(data);
                },
                {
                    onSuccess: () => {
                        if (!member)
                            form.reset({
                                email: '',
                                role: 'member',
                                permissions: defaultMemberPermissions()
                            });
                        router.refresh();
                    },
                    onError: submissionError(
                        member
                            ? 'Could not update this member.'
                            : 'Could not invite this member.'
                    )
                }
            )}
        >
            <FieldGroup>
                {!member ? (
                    <SchemaField
                        form={form}
                        forProperty={t => t.email}
                        label="Invite email"
                        name={prefix + '-email'}
                        variant="email"
                    />
                ) : null}
                <SchemaField
                    form={form}
                    forProperty={t => t.role}
                    label="Role"
                    name={prefix + '-role'}
                    variant="select"
                    fieldProps={{
                        options: [
                            { value: 'member', label: 'Member' },
                            { value: 'admin', label: 'Admin' }
                        ]
                    }}
                />
                <FieldSet>
                    <FieldLegend>Permissions</FieldLegend>
                    <FieldGroup>
                        {permissionOptions.map(([key, label]) => (
                            <SchemaField
                                key={key}
                                form={form}
                                forProperty={t => t.permissions[key]}
                                label={label}
                                name={prefix + '-' + key}
                                variant="checkbox"
                            />
                        ))}
                    </FieldGroup>
                </FieldSet>
                {form.error ? (
                    <FieldError role="alert">{form.error}</FieldError>
                ) : null}
                <Button disabled={form.submitting} type="submit">
                    {form.submitting
                        ? 'Saving...'
                        : member
                          ? 'Update'
                          : 'Invite'}
                </Button>
            </FieldGroup>
        </form>
    );
}

export function AcceptBudgetInvitationForm({ token }: { token: string }) {
    const form = useSchemaForm(AcceptBudgetInvitationBodySchema);
    useEffect(() => {
        form.reset({ token, name: '' });
    }, [form, token]);
    return (
        <form
            noValidate
            onSubmit={form.handleSubmit(
                values =>
                    acceptBudgetInvitationAction(valuesToFormData(values)),
                {
                    onError: submissionError(
                        'Could not accept this invitation.'
                    )
                }
            )}
        >
            <FieldGroup>
                <SchemaField
                    form={form}
                    forProperty={t => t.name}
                    label="Budget name"
                    name="budget-name"
                    fieldProps={{
                        placeholder: 'Shared household',
                        autoComplete: 'off'
                    }}
                />
                {form.error ? (
                    <FieldError role="alert">{form.error}</FieldError>
                ) : null}
                <Button disabled={form.submitting} type="submit">
                    {form.submitting ? 'Joining...' : 'Join budget'}
                </Button>
            </FieldGroup>
        </form>
    );
}
