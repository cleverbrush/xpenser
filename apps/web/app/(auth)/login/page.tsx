import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/forms/login-form';
import { googleSignInAction } from '@/lib/actions';
import { getGoogleSignInProvider, webConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

function safeCallback(value: string | string[] | undefined) {
    const candidate = Array.isArray(value) ? value[0] : value;
    if (!candidate?.startsWith('/') || candidate.startsWith('//')) {
        return undefined;
    }
    return candidate;
}

export default async function LoginPage({
    searchParams
}: {
    readonly searchParams?: Promise<{
        readonly callbackUrl?: string | string[];
    }>;
}) {
    if (webConfig.singleUser?.enabled) {
        redirect('/dashboard');
    }

    const params = searchParams ? await searchParams : {};
    const googleSignInEnabled = getGoogleSignInProvider() !== 'disabled';
    const redirectTo = safeCallback(params.callbackUrl);

    return (
        <main className="flex min-h-dvh items-center justify-center bg-muted px-3 py-6 sm:px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>xpenser</CardTitle>
                    <CardDescription>Sign in to continue.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <LoginForm redirectTo={redirectTo} />
                    {googleSignInEnabled ? (
                        <form action={googleSignInAction}>
                            {redirectTo ? (
                                <input
                                    name="redirectTo"
                                    type="hidden"
                                    value={redirectTo}
                                />
                            ) : null}
                            <Button
                                className="w-full"
                                type="submit"
                                variant="outline"
                            >
                                Sign in with Google
                            </Button>
                        </form>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                        New here?{' '}
                        <Link
                            className="font-medium text-primary"
                            href="/register"
                        >
                            Create an account
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </main>
    );
}
