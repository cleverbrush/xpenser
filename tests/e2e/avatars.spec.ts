import { expect, test } from '@playwright/test';
import { apiBase, loginApi } from './api-helpers';
import { png } from './image-fixtures';

// API setup uses short-lived tokens; never persist them in traces.
test.use({ trace: 'off' });

test('multipart avatar upload stores and retrieves bytes; JSON and unsupported files are rejected', async ({
    request
}) => {
    const headers = await loginApi(request);
    const image = png;
    try {
        const uploaded = await request.put(`${apiBase}/users/me/avatar`, {
            headers,
            multipart: {
                avatar: {
                    name: 'e2e-avatar.png',
                    mimeType: 'image/png',
                    buffer: image
                }
            }
        });
        expect(uploaded.status()).toBe(200);
        const user = await uploaded.json();
        expect(user.hasUploadedAvatar).toBe(true);
        const downloaded = await request.get(
            `${apiBase}/users/${user.id}/avatar`,
            { headers }
        );
        expect(downloaded.status()).toBe(200);
        expect(await downloaded.body()).toEqual(image);
        expect(
            (
                await request.put(`${apiBase}/users/me/avatar`, {
                    headers,
                    data: {
                        imageBase64: image.toString('base64'),
                        mimeType: 'image/png'
                    }
                })
            ).status()
        ).toBe(400);
        expect(
            (
                await request.put(`${apiBase}/users/me/avatar`, {
                    headers,
                    multipart: {
                        avatar: {
                            name: 'bad.pdf',
                            mimeType: 'application/pdf',
                            buffer: Buffer.from('invalid')
                        }
                    }
                })
            ).status()
        ).toBe(400);
    } finally {
        expect(
            (
                await request.delete(`${apiBase}/users/me/avatar`, { headers })
            ).status()
        ).toBe(200);
    }
});

test('avatar form submits a typed image and confirms the saved upload', async ({
    page
}) => {
    await page.goto('/settings/preferences');
    await page
        .getByLabel('Avatar image')
        .setInputFiles({
            name: 'avatar.png',
            mimeType: 'image/png',
            buffer: png
        });
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await expect(
        page.getByText('Avatar uploaded.', { exact: true })
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Remove uploaded avatar' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Remove uploaded avatar' }).click();
    await expect(
        page.getByRole('button', { name: 'Remove uploaded avatar' })
    ).toHaveCount(0);
});
