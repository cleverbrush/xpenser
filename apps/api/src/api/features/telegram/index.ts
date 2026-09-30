import { linkErrors, tokenErrors } from './errors.js';
import { linkTelegramHandler } from './handlers/link.js';
import { telegramTokenHandler } from './handlers/token.js';
import { telegramScope } from './scope.js';

/** Bind telegram handlers once; the root verifies complete contract coverage. */
export const telegramModule = telegramScope.withHandlers({
    link: { handler: linkTelegramHandler, errors: linkErrors },
    token: { handler: telegramTokenHandler, errors: tokenErrors }
});
