import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { expiredSessionPath } from '@/lib/auth-routes';

type CallbackPageProps = {
    readonly searchParams:
        | { readonly code?: string | readonly string[] }
        | Promise<{ readonly code?: string | readonly string[] }>;
};

export default async function PassportCallbackPage(props: CallbackPageProps) {
    const searchParams = await Promise.resolve(props.searchParams);
    const code = Array.isArray(searchParams.code)
        ? searchParams.code[0]
        : searchParams.code;

    if (!code) {
        redirect(`${expiredSessionPath}?error=MissingPassportCode`);
    }

    await signIn('passport-code', {
        code,
        redirectTo: '/dashboard'
    });

    return null;
}
