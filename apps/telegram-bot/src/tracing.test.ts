import { describe, expect, it } from 'vitest';
import {
    telegramCallbackAction,
    telegramCommand,
    telegramSpanAttributes,
    telegramSpanName
} from './tracing.js';

describe('telegram tracing helpers', () => {
    it('extracts command names without retaining command arguments', () => {
        expect(telegramCommand('/start secret-token')).toBe('start');
        expect(telegramCommand('/add@xpenser_bot')).toBe('add');
        expect(telegramCommand('hello')).toBe('unknown');
    });

    it('maps callback data to safe action names', () => {
        expect(telegramCallbackAction('cat:123')).toBe('category_select');
        expect(telegramCallbackAction('catpage:2')).toBe('category_page');
        expect(telegramCallbackAction('cur:USD')).toBe('currency_select');
        expect(telegramCallbackAction('reversal:yes')).toBe('reversal_select');
        expect(telegramCallbackAction('note:add')).toBe('note_add');
        expect(telegramCallbackAction('unknown:secret')).toBe('unknown');
    });

    it('emits safe span names and attributes', () => {
        const attributes = telegramSpanAttributes({
            updateType: 'callback_query',
            callbackAction: telegramCallbackAction('cat:123'),
            chatType: 'private',
            messageId: 42
        });

        expect(
            telegramSpanName({
                updateType: 'callback_query',
                callbackAction: 'category_select'
            })
        ).toBe('telegram callback category_select');
        expect(attributes).toEqual({
            'messaging.system': 'telegram',
            'messaging.operation.name': 'callback_query',
            'telegram.update.type': 'callback_query',
            'telegram.callback.action': 'category_select',
            'telegram.chat.type': 'private',
            'telegram.message.id': 42
        });
        expect(Object.values(attributes)).not.toContain('cat:123');
    });
});
