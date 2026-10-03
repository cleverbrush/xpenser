import { describe, expect, it } from 'vitest';
import { FormInputError, formFailure } from './form-errors';
import { uploadInputError, uploadIssues } from './upload-errors';

describe('upload problem details', () => {
    it.each([
        400, 413
    ])('maps structured file pointers at status %s, keeping unknown paths at the root', status => {
        const error = {
            status,
            body: {
                errors: [
                    { pointer: '/files/image', detail: 'Too big' },
                    { pointer: 'files/image', detail: 'Invalid image' },
                    { pointer: '/files/other', detail: 'Unknown field' },
                    { pointer: '/files', detail: 'Too many parts' }
                ]
            }
        };
        expect(
            uploadIssues(error, 'image')?.map(issue => issue.pointer)
        ).toEqual(['/image', '/image', '', '']);
        expect(
            uploadInputError(error, 'image', 'Choose another image')
        ).toBeInstanceOf(FormInputError);
    });
    it('does not guess fields or swallow unexpected errors', () => {
        const failure = new Error('avatar failed');
        expect(uploadInputError(failure, 'avatar', 'Fallback')).toBe(failure);
        expect(
            uploadIssues(
                {
                    status: 400,
                    body: { errors: [{ pointer: '/files/avatar', detail: 7 }] }
                },
                'avatar'
            )
        ).toBeUndefined();
        expect(formFailure({ status: 413 }, 'Image too large')).toEqual({
            ok: false,
            error: 'Image too large'
        });
        expect(
            uploadIssues(
                {
                    status: 400,
                    body: {
                        errors: [
                            { pointer: '/files/avatar', detail: 'Invalid' }
                        ]
                    }
                },
                'avatar'
            )
        ).toEqual([{ pointer: '/avatar', detail: 'Invalid' }]);
    });
});
