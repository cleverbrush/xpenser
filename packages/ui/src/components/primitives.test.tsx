/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, AvatarFallback, AvatarImage } from './avatar.js';
import { Badge } from './badge.js';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from './card.js';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet
} from './field.js';
import { Spinner } from './spinner.js';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from './table.js';

describe('ui primitives', () => {
    it('renders card regions with caller props and classes', () => {
        render(
            <Card data-testid="card">
                <CardHeader>
                    <CardTitle>Balance</CardTitle>
                    <CardDescription>Current period</CardDescription>
                </CardHeader>
                <CardContent>Content</CardContent>
                <CardFooter>Footer</CardFooter>
            </Card>
        );

        expect(screen.getByTestId('card').className).toContain('rounded-lg');
        expect(screen.getByText('Balance')).toBeTruthy();
        expect(screen.getByText('Current period')).toBeTruthy();
        expect(screen.getByText('Content')).toBeTruthy();
        expect(screen.getByText('Footer')).toBeTruthy();
    });

    it('renders field helpers with accessible labels and messages', () => {
        render(
            <FieldGroup>
                <FieldSet>
                    <FieldLegend>Profile</FieldLegend>
                    <Field>
                        <FieldLabel htmlFor="email">Email</FieldLabel>
                        <input id="email" />
                        <FieldDescription>Used for sign in.</FieldDescription>
                        <FieldError role="alert">Required</FieldError>
                    </Field>
                </FieldSet>
            </FieldGroup>
        );

        expect(screen.getByLabelText('Email')).toBeTruthy();
        expect(screen.getByText('Used for sign in.')).toBeTruthy();
        expect(screen.getByRole('alert').textContent).toBe('Required');
    });

    it('renders table and badge primitives', () => {
        render(
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow data-state="selected">
                        <TableCell>
                            <Badge variant="outline">Active</Badge>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        );

        expect(
            screen.getByRole('columnheader', { name: 'Status' })
        ).toBeTruthy();
        expect(screen.getByText('Active').className).toContain('border');
    });

    it('marks the spinner as decorative', () => {
        const { container } = render(<Spinner className="size-4" />);
        const spinner = container.querySelector('[data-icon="inline-start"]');

        expect(spinner?.getAttribute('aria-hidden')).toBe('true');
        expect(spinner?.getAttribute('class')).toContain('animate-spin');
    });

    it('renders avatar images with a fallback', () => {
        const { container } = render(
            <Avatar data-testid="avatar">
                <AvatarImage
                    alt=""
                    data-testid="avatar-image"
                    src="/vendor-logo.svg"
                />
                <AvatarFallback>WM</AvatarFallback>
            </Avatar>
        );

        expect(screen.getByTestId('avatar').className).toContain(
            'rounded-full'
        );
        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            '/vendor-logo.svg'
        );
        expect(
            screen.getByTestId('avatar-image').getAttribute('class')
        ).not.toContain('opacity-0');

        fireEvent.error(screen.getByTestId('avatar-image'));

        expect(container.querySelector('img')).toBeNull();
        expect(screen.getByText('WM')).toBeTruthy();
    });
});
