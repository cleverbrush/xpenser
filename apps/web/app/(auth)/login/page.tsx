import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import Link from 'next/link';
import { LoginForm } from '@/components/forms/login-form';
import { googleSignInAction } from '@/lib/actions';

export default function LoginPage() {
    return (
        <main className="flex min-h-dvh items-center justify-center bg-muted px-3 py-6 sm:px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>xpenser</CardTitle>
                    <CardDescription>Sign in to continue.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <LoginForm />
                    <form action={googleSignInAction}>
                        <Button
                            className="w-full"
                            type="submit"
                            variant="outline"
                        >
                            Sign in with Google
                        </Button>
                    </form>
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
