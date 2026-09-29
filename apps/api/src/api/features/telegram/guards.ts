import { ActionResult } from '@cleverbrush/server';

export function unauthorizedBot() {
    return ActionResult.unauthorized({
        message: 'Invalid Telegram service credentials.'
    });
}
