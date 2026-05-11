import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { Send, Unlink } from 'lucide-react';
import { CategorySettings } from '@/components/category-settings';
import { PreferencesForm } from '@/components/forms/preferences-form';
import {
    createTelegramLinkAction,
    disconnectTelegramAction
} from '@/lib/actions';
import { getApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function PreferencesPage() {
    const client = await getApiClient();
    const [me, currencies, categories, telegram] = await Promise.all([
        client.auth.me(),
        client.currencies.list(),
        client.categories.list(),
        client.users.telegramStatus()
    ]);
    const telegramName = telegram.telegramUsername
        ? `@${telegram.telegramUsername}`
        : [telegram.telegramFirstName, telegram.telegramLastName]
              .filter(Boolean)
              .join(' ');

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-5 sm:gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>User preferences</CardTitle>
                    <CardDescription>
                        Default currency changes affect future conversions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PreferencesForm currencies={currencies} me={me} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                            <CardTitle>Telegram bot</CardTitle>
                            <CardDescription>
                                Connect Telegram to create transactions without
                                opening xpenser.
                            </CardDescription>
                        </div>
                        <Badge
                            variant={telegram.linked ? 'default' : 'outline'}
                        >
                            {telegram.linked ? 'Connected' : 'Not connected'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            {telegram.linked
                                ? `Telegram account ${telegramName || 'is connected'}.`
                                : 'Generate a one-time Telegram link from this account.'}
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <form action={createTelegramLinkAction}>
                                <Button
                                    className="w-full sm:w-auto"
                                    type="submit"
                                >
                                    <Send className="size-4" />
                                    {telegram.linked
                                        ? 'Reconnect'
                                        : 'Connect Telegram'}
                                </Button>
                            </form>
                            {telegram.linked ? (
                                <form action={disconnectTelegramAction}>
                                    <Button
                                        className="w-full sm:w-auto"
                                        type="submit"
                                        variant="outline"
                                    >
                                        <Unlink className="size-4" />
                                        Disconnect
                                    </Button>
                                </form>
                            ) : null}
                        </div>
                    </div>
                </CardContent>
            </Card>
            <CategorySettings categories={categories} />
        </div>
    );
}
