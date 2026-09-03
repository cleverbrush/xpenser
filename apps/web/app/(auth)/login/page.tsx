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
import { ResendEmailConfirmationForm } from '@/components/forms/resend-email-confirmation-form';
import { googleSignInAction } from '@/lib/actions';
import { getGoogleSignInProvider, webConfig } from '@/lib/config';

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
        readonly confirmation?: string | string[];
    }>;
}) {
    if (webConfig.singleUser?.enabled) {
        redirect('/dashboard');
    }

    const params = searchParams ? await searchParams : {};
    const googleSignInEnabled = getGoogleSignInProvider() !== 'disabled';
    const redirectTo = safeCallback(params.callbackUrl);
    const confirmation = Array.isArray(params.confirmation)
        ? params.confirmation[0]
        : params.confirmation;
    const showConfirmationRecovery = confirmation === 'invalid-or-expired';

    return (
        <main className="flex min-h-dvh items-center justify-center bg-muted px-3 py-6 sm:px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>xpenser</CardTitle>
                    <CardDescription>Sign in to continue.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {showConfirmationRecovery ? (
                        <section
                            aria-labelledby="confirmation-recovery-title"
                            className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                        >
                            <div className="space-y-1">
                                <h2
                                    className="text-sm font-medium"
                                    id="confirmation-recovery-title"
                                >
                                    Confirmation link is invalid or expired.
                                </h2>
                                <p className="text-sm">
                                    Enter your email to request a new
                                    confirmation link.
                                </p>
                            </div>
                            <ResendEmailConfirmationForm />
                        </section>
                    ) : null}
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
