/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { TransactionTag } from '@xpenser/contracts';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TransactionTagPicker } from './transaction-tag-picker';

const timestamp = new Date('2026-06-01T00:00:00.000Z');

function tag(overrides: Partial<TransactionTag> = {}): TransactionTag {
    return {
        id: 1,
        name: 'wife',
        transactionCount: 2,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function Harness() {
    const [selectedTags, setSelectedTags] = useState<readonly string[]>([]);

    return (
        <TransactionTagPicker
            tags={[tag(), tag({ id: 2, name: 'travel' })]}
            selectedTags={selectedTags}
            onChange={setSelectedTags}
        />
    );
}

describe('TransactionTagPicker', () => {
    it('selects existing tags, creates typed tags, and removes selections', () => {
        render(<Harness />);

        const input = screen.getByLabelText('Tags');
        fireEvent.focus(input);
        fireEvent.click(screen.getByRole('button', { name: 'wife' }));

        expect(
            screen.getByRole('button', { name: 'Remove tag wife' })
        ).toBeTruthy();
        expect(screen.getByText('wife')).toBeTruthy();

        fireEvent.change(input, { target: { value: 'me' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add me' }));

        expect(
            screen.getByRole('button', { name: 'Remove tag me' })
        ).toBeTruthy();

        fireEvent.click(
            screen.getByRole('button', { name: 'Remove tag wife' })
        );

        expect(
            screen.queryByRole('button', { name: 'Remove tag wife' })
        ).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Remove tag me' })
        ).toBeTruthy();
    });
});
