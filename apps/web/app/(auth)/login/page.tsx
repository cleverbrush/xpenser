import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Field,
    FieldGroup,
    FieldLabel,
    Input
} from '@xpenser/ui';
import Link from 'next/link';
import { googleSignInAction, loginAction } from '@/lib/actions';

export default function LoginPage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-muted px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>xpenser</CardTitle>
                    <CardDescription>Sign in to continue.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <form action={loginAction}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="email">Email</FieldLabel>
                                <Input
                                    autoComplete="email"
                                    id="email"
                                    name="email"
                                    required
                                    type="email"
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="password">
                                    Password
                                </FieldLabel>
                                <Input
                                    autoComplete="current-password"
                                    id="password"
                                    name="password"
                                    required
                                    type="password"
                                />
                            </Field>
                            <Button type="submit">Sign in</Button>
                        </FieldGroup>
                    </form>
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
