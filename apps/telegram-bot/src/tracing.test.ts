import { describe, expect, it } from 'vitest';
import {
    telegramCallbackAction,
    telegramCommand,
    telegramSpanAttributes,
    telegramSpanName,
    traceTelegramUpdate
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
        expect(telegramCallbackAction('vendor:select:123')).toBe(
            'vendor_select'
        );
        expect(telegramCallbackAction('vendorpage:2')).toBe('vendor_page');
        expect(telegramCallbackAction('scan:edit:amount')).toBe('scan_edit');
        expect(telegramCallbackAction('scan:confirm')).toBe('scan_confirm');
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

    it('returns handler results and propagates handler errors from traced updates', async () => {
        await expect(
            traceTelegramUpdate(
                { updateType: 'command', command: 'start' },
                async () => 'ok'
            )
        ).resolves.toBe('ok');

        await expect(
            traceTelegramUpdate(
                { updateType: 'message' },
                async (): Promise<string> => {
                    throw new Error('handler failed');
                }
            )
        ).rejects.toThrow('handler failed');
    });
});
