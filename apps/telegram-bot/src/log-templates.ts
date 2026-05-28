import { number, object, parseString, string } from '@cleverbrush/schema';

export const ShutdownSignalReceived = parseString(
    object({ Signal: string() }),
    $t => $t`Received shutdown signal ${t => t.Signal}`
);

export const TelegramPollingError = parseString(
    object({ SuppressedCount: number() }),
    $t => $t`Telegram polling error`
);
