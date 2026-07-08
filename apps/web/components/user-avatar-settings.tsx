'use client';

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
    Input
} from '@xpenser/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { deleteUserAvatarAction, updateUserAvatarAction } from '@/lib/actions';
import { isNextRedirectError } from './forms/form-utils';
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

export function UserAvatarSettings({ me }: { readonly me: UserPreference }) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const form = event.currentTarget;
        const input = form.elements.namedItem('avatar');
        const file =
            input instanceof HTMLInputElement
                ? (input.files?.[0] ?? null)
                : null;
        if (!file) {
            setError('Choose an avatar image.');
            setMessage(null);
            return;
        }
        const validationError = avatarValidationError(file);
        if (validationError) {
            setError(validationError);
            setMessage(null);
            return;
        }

        setPending(true);
        setError(null);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const response = await updateUserAvatarAction(formData);
            if (response && 'error' in response && response.error) {
                setError(response.error);
                return;
            }
            form.reset();
            setMessage('Avatar uploaded.');
            router.refresh();
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError('Could not upload avatar. Choose another image.');
        } finally {
            setPending(false);
        }
    }

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
                                name="avatar"
                                required
                                type="file"
                            />
                            <Button disabled={pending} type="submit">
                                {pending ? 'Uploading...' : 'Upload'}
                            </Button>
                        </form>
                        {error ? (
                            <FieldError role="alert">{error}</FieldError>
                        ) : null}
                        {message ? (
                            <p
                                className="text-sm text-muted-foreground"
                                role="status"
                            >
                                {message}
                            </p>
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
