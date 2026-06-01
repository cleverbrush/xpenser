import { describe, expect, it } from 'vitest';
import type { Config } from '../../config.js';
import { emailReportTestSendHandler } from './email-reports.js';

describe('email report test send handler', () => {
    it('rejects missing test credentials', async () => {
        const result = await emailReportTestSendHandler(
            {
                context: { headers: {} }
            } as never,
            {
                config: {
                    emailReports: { testSecret: 'secret' }
                } as Config
            } as never
        );

        expect(result).toMatchObject({
            status: 401,
            body: { message: 'Invalid email report test credentials.' }
        });
    });
});
