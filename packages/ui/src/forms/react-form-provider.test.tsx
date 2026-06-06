/**
 * @vitest-environment jsdom
 */

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import { boolean, number, object, string } from '@cleverbrush/schema';
import { render, screen } from '@testing-library/react';
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
