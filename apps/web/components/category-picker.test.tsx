/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CategoryPicker } from './category-picker';

describe('CategoryPicker', () => {
    it('shows an empty placeholder and associates touched validation with the trigger', () => {
        render(
            <CategoryPicker
                categories={[]}
                value={undefined}
                onChange={vi.fn()}
                error="Choose a category"
                touched
            />
        );
        const trigger = screen.getByRole('combobox', {
            name: 'Transaction category'
        });
        expect(trigger.textContent).toBe('Select category');
        expect(trigger.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(trigger.getAttribute('aria-describedby')!)
                ?.textContent
        ).toBe('Choose a category');
    });

    it('marks the field touched on closing and emits numeric category IDs', async () => {
        Element.prototype.scrollIntoView = vi.fn();
        const onChange = vi.fn();
        const onBlur = vi.fn();
        render(
            <CategoryPicker
                categories={[{ id: 7, displayName: 'Food / Groceries' }]}
                value={undefined}
                onChange={onChange}
                onBlur={onBlur}
                error="Choose a category"
            />
        );
        const trigger = screen.getByRole('combobox', {
            name: 'Transaction category'
        });
        expect(trigger.getAttribute('aria-describedby')).toBeNull();
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        fireEvent.click(
            await screen.findByRole('option', { name: 'Food / Groceries' })
        );
        expect(onChange).toHaveBeenCalledWith(7);
        expect(onBlur).toHaveBeenCalled();
    });
});
