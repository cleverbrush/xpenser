import type { GoogleSignInBody } from '@xpenser/contracts';

export const GoogleSignInModes = [
    'auto',
    'direct',
    'passport',
    'disabled'
] as const;

export type GoogleSignInMode = (typeof GoogleSignInModes)[number];
export type GoogleSignInProvider = 'direct' | 'passport' | 'disabled';

type GoogleSignInProviderOptions = {
    readonly mode: GoogleSignInMode;
    readonly googleClientId?: string;
    readonly googleClientSecret?: string;
    readonly passportBaseUrl?: string;
    readonly passportProject?: string;
    readonly passportEnvironment?: string;
};

type GoogleAuthAccount = {
    readonly providerAccountId?: string | null;
};

type GoogleAuthProfile = Record<string, unknown> | undefined;

function present(value: string | undefined): boolean {
    return typeof value === 'string' && value.trim() !== '';
}

export function resolveGoogleSignInProvider({
    mode,
    googleClientId,
    googleClientSecret,
    passportBaseUrl,
    passportEnvironment,
    passportProject
}: GoogleSignInProviderOptions): GoogleSignInProvider {
    const directConfigured =
        present(googleClientId) && present(googleClientSecret);
    const passportConfigured =
        present(passportBaseUrl) &&
        present(passportProject) &&
        present(passportEnvironment);

    if (mode === 'disabled') {
        return 'disabled';
    }
    if (mode === 'direct') {
        if (!directConfigured) {
            throw new Error(
                'GOOGLE_SIGN_IN_MODE=direct requires AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.'
            );
        }
        return 'direct';
    }
    if (mode === 'passport') {
        if (!passportConfigured) {
            throw new Error(
                'GOOGLE_SIGN_IN_MODE=passport requires PASSPORT_BASE_URL, PASSPORT_PROJECT, and PASSPORT_ENVIRONMENT.'
            );
        }
        return 'passport';
    }

    if (directConfigured) {
        return 'direct';
    }
    if (passportConfigured) {
        return 'passport';
    }
    return 'disabled';
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() !== ''
        ? value.trim()
        : undefined;
}

function booleanValue(value: unknown): boolean {
    return value === true || value === 'true';
}

export function googleSignInBodyFromAuthProfile(
    account: GoogleAuthAccount,
    profile: GoogleAuthProfile
): GoogleSignInBody {
    const providerSubject =
        stringValue(profile?.sub) ?? stringValue(account.providerAccountId);
    const email = stringValue(profile?.email);

    if (!providerSubject) {
        throw new Error('Google profile subject is missing.');
    }
    if (!email) {
        throw new Error('Google profile email is missing.');
    }

    return {
        providerSubject,
        email,
        emailVerified: booleanValue(profile?.email_verified),
        name: stringValue(profile?.name),
        avatarUrl: stringValue(profile?.picture)
    };
}
