import { ActionResult, errorMap } from '@cleverbrush/server';
import {
    TelegramAccountConflictError,
    TelegramAccountNotLinkedError,
    TelegramLinkTokenInvalidError
} from '../../../application/telegram.js';

/** Preserve the expected errors handled by telegram.link. */
export const linkErrors = errorMap()
    .on(TelegramLinkTokenInvalidError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(TelegramAccountConflictError, err =>
        ActionResult.conflict({ message: err.message })
    );

/** Preserve the expected errors handled by telegram.token. */
export const tokenErrors = errorMap().on(TelegramAccountNotLinkedError, err =>
    ActionResult.unauthorized({ message: err.message })
);
