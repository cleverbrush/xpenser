import { ActionResult, type Handler } from '@cleverbrush/server';
import { EmailConfigError } from '../../application/email.js';
import {
    EmailReportConfigError,
    sendTestEmailReportsForAndrew
} from '../../application/email-reports.js';
import { OpenAIConfigError } from '../../application/openai.js';
import type { EmailReportTestSendEndpoint } from '../endpoints.js';

const testSecretHeader = 'x-email-reports-test-secret';

export const emailReportTestSendHandler: Handler<
    typeof EmailReportTestSendEndpoint
> = async ({ context }, { db, knex, config }) => {
    if (
        !config.emailReports.testSecret ||
        context.headers[testSecretHeader] !== config.emailReports.testSecret
    ) {
        return ActionResult.unauthorized({
            message: 'Invalid email report test credentials.'
        });
    }

    try {
        return await sendTestEmailReportsForAndrew(db, knex, config);
    } catch (err) {
        if (
            err instanceof EmailReportConfigError ||
            err instanceof EmailConfigError ||
            err instanceof OpenAIConfigError
        ) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};
