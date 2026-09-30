'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
import { any, object } from '@cleverbrush/schema';
import type { UserPreference } from '@xpenser/contracts';
import { UserAvatarLimits } from '@xpenser/contracts';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    FieldError,
    Input,
    toast
} from '@xpenser/ui';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { deleteUserAvatarAction, updateUserAvatarAction } from '@/lib/actions';
import { mapFormIssues } from '@/lib/form-result';
import { submissionError } from './forms/submission-error';
import { UserAvatar } from './user-avatar';

const allowedAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'];

function avatarValidationError(file: File | null): string | undefined {
    if (!file || file.size === 0) {
        return 'Choose an avatar image.';
    }
    if (!allowedAvatarTypes.includes(file.type)) {
        return 'Upload a PNG, JPEG, or WebP image.';
    }
    if (file.size > UserAvatarLimits.maxImageBytes) {
        return `Avatar image must be ${Math.round(
            UserAvatarLimits.maxImageBytes / 1024
        )} KB or smaller.`;
    }
    return undefined;
}

const AvatarFormSchema = object({
    avatar: any()
        .hasType<File | undefined>()
        .addValidator(file => {
            const error = avatarValidationError(file ?? null);
            return error
                ? { valid: false, errors: [{ message: error }] }
                : { valid: true };
        })
});

export function UserAvatarSettings({ me }: { readonly me: UserPreference }) {
    const router = useRouter();
    const form = useSchemaForm(AvatarFormSchema);
    const avatar = form.useField(t => t.avatar);
    const inputRef = useRef<HTMLInputElement>(null);
    const error = form.error;
    const pending = form.submitting;
    const handleSubmit = form.handleSubmit(
        async values => {
            const data = new FormData();
            if (values.avatar) data.append('avatar', values.avatar);
            return mapFormIssues(await updateUserAvatarAction(data), pointer =>
                ['/mimeType', '/imageBase64', '/fileName'].includes(pointer)
                    ? '/avatar'
                    : pointer
            );
        },
        {
            onSuccess: () => {
                form.reset();
                if (inputRef.current) inputRef.current.value = '';
                toast.success('Avatar uploaded.');
                router.refresh();
            },
            onError: submissionError(
                'Could not upload avatar. Choose another image.'
            )
        }
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Avatar</CardTitle>
                <CardDescription>
                    Upload an image or keep the one from your sign-in provider.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                            avatarUrl={me.avatarUrl}
                            className="size-12"
                            email={me.email}
                        />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                                {me.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                PNG, JPEG, or WebP up to{' '}
                                {Math.round(
                                    UserAvatarLimits.maxImageBytes / 1024
                                )}{' '}
                                KB.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:min-w-80">
                        <form
                            className="flex flex-col gap-2 sm:flex-row"
                            encType="multipart/form-data"
                            noValidate
                            onSubmit={handleSubmit}
                        >
                            <Input
                                accept="image/png,image/jpeg,image/webp"
                                aria-label="Avatar image"
                                ref={inputRef}
                                aria-invalid={
                                    avatar.touched && Boolean(avatar.error)
                                }
                                aria-describedby={
                                    avatar.error ? 'avatar-error' : undefined
                                }
                                onBlur={avatar.onBlur}
                                onChange={event => {
                                    avatar.onChange(event.target.files?.[0]);
                                    form.setIssues([]);
                                }}
                                name="avatar"
                                required
                                type="file"
                            />
                            <Button disabled={pending} type="submit">
                                {pending ? 'Uploading...' : 'Upload'}
                            </Button>
                        </form>
                        {avatar.touched && avatar.error ? (
                            <FieldError id="avatar-error" role="alert">
                                {avatar.error}
                            </FieldError>
                        ) : null}
                        {error ? (
                            <FieldError role="alert">{error}</FieldError>
                        ) : null}
                        {me.hasUploadedAvatar ? (
                            <form action={deleteUserAvatarAction}>
                                <Button
                                    className="w-full sm:w-auto"
                                    type="submit"
                                    variant="outline"
                                >
                                    Remove uploaded avatar
                                </Button>
                            </form>
                        ) : null}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
