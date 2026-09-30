import { ApiError } from '@cleverbrush/client';
import { object, string } from '@cleverbrush/schema';
import { describe, expect, it, vi } from 'vitest';
import {
    FormInputError,
    formFailure,
    runFormAction,
    schemaIssues
} from './form-errors';
import { mapFormIssues, pointerForField } from './form-result';

const problem = (errors: unknown, status = 400) =>
    new ApiError(status, 'Invalid', {
        type: 'about:blank',
        title: 'Invalid request',
        status,
        errors
    });

describe('form error boundary', () => {
    it.each([
        400, 422
    ])('serializes %s issues and preserves explicit path meaning', async status => {
        const result = await runFormAction(async () => {
            throw problem(
                [
                    { pointer: '/body/name', detail: 'Name rejected' },
                    { pointer: '/body/a~1b~0c', detail: 'Escaped key' },
                    { pointer: '/body/tags/0', detail: 'Tag rejected' },
                    { pointer: '/query/name', detail: 'Query issue' },
                    { pointer: '/body/notRendered', detail: 'Unbound issue' }
                ],
                status
            );
        }, 'Check your input.');
        expect(JSON.parse(JSON.stringify(result))).toEqual({
            ok: false,
            error: 'Check your input.',
            issues: [
                { pointer: '/name', detail: 'Name rejected' },
                { pointer: '/a~1b~0c', detail: 'Escaped key' },
                { pointer: '/tags', detail: 'Tag rejected' },
                { pointer: '', detail: 'Query issue' },
                { pointer: '/notRendered', detail: 'Unbound issue' }
            ]
        });
    });

    it('does not expose malformed problem details or infer fields from domain messages', () => {
        expect(
            formFailure(
                problem([{ pointer: '/body/name', detail: 7 }]),
                'Safe fallback'
            )
        ).toEqual({ ok: false, error: 'Safe fallback' });
        expect(
            formFailure(
                new ApiError(409, 'Conflict', { message: 'Name exists' }),
                'Failed'
            )
        ).toEqual({ ok: false, error: 'Name exists' });
    });

    it('preserves local schema pointers and maps explicit UI shapes only', () => {
        const result = object({ 'a/b~c': string().nonempty() }).validate({
            'a/b~c': ''
        });
        const issues = schemaIssues(result);
        expect(issues).toEqual([
            expect.objectContaining({ pointer: '/a~1b~0c' })
        ]);
        expect(pointerForField('a/b~c')).toBe('/a~1b~0c');
        const failure = formFailure(
            new FormInputError('Check fields', issues),
            'Failed'
        );
        expect(
            mapFormIssues(failure, pointer => '/rows/2' + pointer)
        ).toMatchObject({
            issues: [{ pointer: '/rows/2/a~1b~0c' }]
        });
    });

    it('does not swallow navigation or unexpected errors', async () => {
        for (const error of [
            Object.assign(new Error('redirect'), {
                digest: 'NEXT_REDIRECT;replace;/login'
            }),
            new Error('private database details'),
            new ApiError(500, 'Internal', { message: 'private' })
        ]) {
            await expect(
                runFormAction(async () => {
                    throw error;
                }, 'Safe')
            ).rejects.toBe(error);
        }
    });

    it('returns typed success data without running failure handling', async () => {
        const save = vi.fn(async () => ({ id: 12 }));
        expect(await runFormAction(save, 'Failed')).toEqual({
            ok: true,
            data: { id: 12 }
        });
        expect(save).toHaveBeenCalledOnce();
    });
});
