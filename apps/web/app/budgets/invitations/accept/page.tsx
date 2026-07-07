import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import Link from 'next/link';
import { acceptBudgetInvitationAction } from '@/lib/actions';

type AcceptInvitationSearchParams = {
    readonly token?: string | readonly string[];
};

function readToken(value: AcceptInvitationSearchParams['token']) {
    const token = Array.isArray(value) ? value[0] : value;
    return typeof token === 'string' ? token : undefined;
}

export default async function AcceptBudgetInvitationPage({
    searchParams
}: {
    readonly searchParams: Promise<AcceptInvitationSearchParams>;
}) {
    const token = readToken((await searchParams).token);

    return (
        <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4 py-10">
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Join budget</CardTitle>
                    <CardDescription>
                        Accept the invitation to add this shared budget to your
                        xpenser account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {token ? (
                        <form
                            action={acceptBudgetInvitationAction}
                            className="flex flex-col gap-3"
                        >
                            <input name="token" type="hidden" value={token} />
                            <Button type="submit">Join budget</Button>
                            <Button asChild type="button" variant="outline">
                                <Link href="/dashboard">Not now</Link>
                            </Button>
                        </form>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm text-muted-foreground">
                                This invitation link is missing its token.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard">Open xpenser</Link>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
