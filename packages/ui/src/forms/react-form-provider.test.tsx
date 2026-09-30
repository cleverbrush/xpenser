/**
 * @vitest-environment jsdom
 */

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import { boolean, number, object, string } from '@cleverbrush/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { XpenserFormProvider } from './react-form-provider.js';

const ExampleSchema = object({
    email: string().email(),
    password: string(),
    amount: number(),
    enabled: boolean()
});

function ExampleForm() {
    const form = useSchemaForm(ExampleSchema);

    return (
        <XpenserFormProvider>
            <SchemaField
                forProperty={field => field.email}
                form={form}
                label="Email"
                name="email"
                variant="email"
            />
            <SchemaField
                forProperty={field => field.password}
                form={form}
                label="Password"
                name="password"
                variant="password"
            />
            <SchemaField
                forProperty={field => field.amount}
                form={form}
                label="Amount"
                name="amount"
            />
            <SchemaField
                forProperty={field => field.enabled}
                form={form}
                label="Enabled"
                name="enabled"
                variant="checkbox"
            />
        </XpenserFormProvider>
    );
}

describe('XpenserFormProvider', () => {
    it('gives unnamed controls distinct stable error descriptions', () => {
        function Form() {
            const form = useSchemaForm(ExampleSchema);
            return (
                <XpenserFormProvider>
                    <SchemaField
                        form={form}
                        forProperty={t => t.email}
                        label="Unnamed email"
                    />
                    <SchemaField
                        form={form}
                        forProperty={t => t.password}
                        label="Unnamed password"
                    />
                    <button
                        type="button"
                        onClick={() =>
                            form.setIssues([
                                { pointer: '/email', detail: 'Email rejected' },
                                {
                                    pointer: '/password',
                                    detail: 'Password rejected'
                                }
                            ])
                        }
                    >
                        Reject fields
                    </button>
                </XpenserFormProvider>
            );
        }
        render(<Form />);
        const email = screen.getByLabelText('Unnamed email');
        const password = screen.getByLabelText('Unnamed password');
        expect(email.id).not.toBe(password.id);
        fireEvent.click(screen.getByRole('button', { name: 'Reject fields' }));
        expect(
            document.getElementById(email.getAttribute('aria-describedby')!)
                ?.textContent
        ).toBe('Email rejected');
        expect(
            document.getElementById(password.getAttribute('aria-describedby')!)
                ?.textContent
        ).toBe('Password rejected');
    });
    it('renders children inside the form system provider', () => {
        render(
            <XpenserFormProvider>
                <span>Form content</span>
            </XpenserFormProvider>
        );

        expect(screen.getByText('Form content')).toBeTruthy();
    });

    it('registers type and variant renderers for schema-driven fields', () => {
        render(<ExampleForm />);

        expect(screen.getByLabelText('Email').getAttribute('type')).toBe(
            'email'
        );
        expect(screen.getByLabelText('Password').getAttribute('type')).toBe(
            'password'
        );
        expect(screen.getByLabelText('Amount').getAttribute('type')).toBe(
            'number'
        );
        expect(screen.getByLabelText('Enabled').getAttribute('type')).toBe(
            'checkbox'
        );
    });
});
