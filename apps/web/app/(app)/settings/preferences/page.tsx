import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { FolderTreeIcon, Send, StoreIcon, Unlink } from 'lucide-react';
import Link from 'next/link';
import { ApiKeysSettings } from '@/components/api-keys-settings';
import { PreferencesForm } from '@/components/forms/preferences-form';
import {
    createTelegramLinkAction,
    disconnectTelegramAction
} from '@/lib/actions';
import { getApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function PreferencesPage() {
    const client = await getApiClient();
    const [me, currencies, telegram, apiKeys] = await Promise.all([
        client.auth.me(),
        client.currencies.list(),
        client.users.telegramStatus(),
        client.users.listApiKeys()
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
                        Default currency affects future conversions. Time zone
                        affects transaction display and reports.
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
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                            <CardTitle>Categories</CardTitle>
                            <CardDescription>
                                Manage expense and income categories,
                                subcategories, and archived entries.
                            </CardDescription>
                        </div>
                        <Button asChild className="w-full sm:w-auto">
                            <Link href="/settings/categories">
                                <FolderTreeIcon
                                    aria-hidden
                                    className="size-4"
                                />
                                Manage categories
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                            <CardTitle>Merchants</CardTitle>
                            <CardDescription>
                                Manage merchant details, enrichment status, and
                                transaction history.
                            </CardDescription>
                        </div>
                        <Button asChild className="w-full sm:w-auto">
                            <Link href="/settings/merchants">
                                <StoreIcon aria-hidden className="size-4" />
                                Manage merchants
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>API keys</CardTitle>
                    <CardDescription>
                        Use API keys from scripts and external tools.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ApiKeysSettings apiKeys={apiKeys} />
                </CardContent>
            </Card>
        </div>
    );
}
