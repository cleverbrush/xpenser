import {
    type SpanAttributes,
    SpanKind,
    SpanStatusCode,
    trace
} from '@opentelemetry/api';

export type TelegramUpdateType = 'command' | 'callback_query' | 'message';

export type TelegramUpdateSpanInfo = {
    readonly updateType: TelegramUpdateType;
    readonly command?: string;
    readonly callbackAction?: string;
    readonly chatType?: string;
    readonly messageId?: number;
};

const tracer = trace.getTracer('xpenser.telegram-bot');

/**
 * Extracts a low-cardinality Telegram command name for span names and
 * attributes without retaining command arguments such as deep-link tokens.
 */
export function telegramCommand(text: string | undefined): string {
    const match = (text ?? '').trim().match(/^\/([a-zA-Z0-9_]+)(?:@\S+)?/);
    const command = match?.[1];
    return command?.toLowerCase() ?? 'unknown';
}

/**
 * Maps callback payloads to safe action names.
 *
 * Callback payloads can contain category IDs or other user data, so only the
 * action family is recorded in telemetry.
 */
export function telegramCallbackAction(data: string | undefined): string {
    if (!data) {
        return 'unknown';
    }
    if (data === 'cancel') {
        return 'cancel';
    }
    if (data.startsWith('catpage:')) {
        return 'category_page';
    }
    if (data.startsWith('cat:')) {
        return 'category_select';
    }
    if (data.startsWith('cur:')) {
        return 'currency_select';
    }
    if (data === 'vendor:none') {
        return 'vendor_none';
    }
    if (data === 'vendor:search') {
        return 'vendor_search';
    }
    if (data.startsWith('vendorpage:')) {
        return 'vendor_page';
    }
    if (data.startsWith('vendor:select:')) {
        return 'vendor_select';
    }
    if (data === 'note:skip') {
        return 'note_skip';
    }
    if (data === 'note:add') {
        return 'note_add';
    }
    if (data.startsWith('scan:edit:')) {
        return 'scan_edit';
    }
    if (data === 'scan:confirm') {
        return 'scan_confirm';
    }
    if (data === 'scan:discard') {
        return 'scan_discard';
    }
    if (data === 'scan:previous') {
        return 'scan_previous';
    }
    if (data === 'scan:next') {
        return 'scan_next';
    }
    return 'unknown';
}

export function telegramSpanName(info: TelegramUpdateSpanInfo): string {
    if (info.updateType === 'command') {
        return `telegram command ${info.command ?? 'unknown'}`;
    }
    if (info.updateType === 'callback_query') {
        return `telegram callback ${info.callbackAction ?? 'unknown'}`;
    }
    return 'telegram message';
}

export function telegramSpanAttributes(
    info: TelegramUpdateSpanInfo
): SpanAttributes {
    return {
        'messaging.system': 'telegram',
        'messaging.operation.name': info.updateType,
        'telegram.update.type': info.updateType,
        ...(info.command ? { 'telegram.command': info.command } : {}),
        ...(info.callbackAction
            ? { 'telegram.callback.action': info.callbackAction }
            : {}),
        ...(info.chatType ? { 'telegram.chat.type': info.chatType } : {}),
        ...(info.messageId !== undefined
            ? { 'telegram.message.id': info.messageId }
            : {})
    };
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export async function traceTelegramUpdate<T>(
    info: TelegramUpdateSpanInfo,
    handler: () => Promise<T>
): Promise<T> {
    return tracer.startActiveSpan(
        telegramSpanName(info),
        {
            kind: SpanKind.CONSUMER,
            attributes: telegramSpanAttributes(info)
        },
        async span => {
            try {
                const result = await handler();
                span.setAttribute('telegram.update.success', true);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (err) {
                span.setAttribute('telegram.update.success', false);
                span.recordException(
                    err instanceof Error ? err : errorMessage(err)
                );
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: errorMessage(err)
                });
                throw err;
            } finally {
                span.end();
            }
        }
    );
}
