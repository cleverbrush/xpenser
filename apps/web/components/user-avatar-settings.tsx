import type { UserPreference } from '@xpenser/contracts';
import { UserAvatarLimits } from '@xpenser/contracts';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input
} from '@xpenser/ui';
import { deleteUserAvatarAction, updateUserAvatarAction } from '@/lib/actions';

function fallbackText(me: UserPreference): string {
    return me.email.slice(0, 2).toUpperCase();
}

export function UserAvatarSettings({ me }: { readonly me: UserPreference }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Avatar</CardTitle>
                <CardDescription>
                    Show your avatar next to transactions you add in shared
                    budgets.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-12">
                            <AvatarImage alt={me.email} src={me.avatarUrl} />
                            <AvatarFallback>{fallbackText(me)}</AvatarFallback>
                        </Avatar>
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
                            action={updateUserAvatarAction}
                            className="flex flex-col gap-2 sm:flex-row"
                        >
                            <Input
                                accept="image/png,image/jpeg,image/webp"
                                aria-label="Avatar image"
                                name="avatar"
                                required
                                type="file"
                            />
                            <Button type="submit">Upload</Button>
                        </form>
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
