import { expect, test } from '@playwright/test';
import { apiBase, loginApi } from './api-helpers';

test.use({ trace: 'off', storageState: { cookies: [], origins: [] } });

test('public scan progress uses its job token instead of login authentication', async ({
    request
}) => {
    const status = await request.get(
        `${apiBase}/transaction-scans/jobs/status`,
        {
            params: { jobId: 'missing-scan-job', token: 'invalid-scan-token' }
        }
    );
    expect(status.status()).toBe(200);
    expect(await status.json()).toMatchObject({
        jobId: 'missing-scan-job',
        stage: 'failed',
        scan: null,
        error: 'Scan job was not found.'
    });
});

test('receipt upload rejects unsupported file types', async ({ request }) => {
    const headers = await loginApi(request);
    const response = await request.post(`${apiBase}/transaction-scans/jobs`, {
        headers,
        multipart: {
            image: {
                name: 'bad.pdf',
                mimeType: 'application/pdf',
                buffer: Buffer.from('invalid')
            }
        }
    });
    expect(response.status()).toBe(400);
});
