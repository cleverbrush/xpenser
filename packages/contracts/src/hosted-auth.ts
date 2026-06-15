export const HostedXpenserOrigin = 'https://xpenser.cleverbrush.com';

export const HostedXpenserPassportDefaults = {
    baseUrl: 'https://auth.cleverbrush.com',
    project: 'xpenser',
    environment: 'production'
} as const;

export type PassportProviderConfig = {
    readonly baseUrl?: string;
    readonly project?: string;
    readonly environment?: string;
};

function present(value: string | undefined): boolean {
    return typeof value === 'string' && value.trim() !== '';
}

export function isHostedXpenserAppUrl(appUrl: string): boolean {
    try {
        return new URL(appUrl).origin === HostedXpenserOrigin;
    } catch {
        return false;
    }
}

export function applyHostedPassportDefaults(
    appUrl: string,
    passport: PassportProviderConfig
): PassportProviderConfig {
    if (!isHostedXpenserAppUrl(appUrl)) {
        return passport;
    }

    return {
        ...passport,
        baseUrl: present(passport.baseUrl)
            ? passport.baseUrl
            : HostedXpenserPassportDefaults.baseUrl,
        project: present(passport.project)
            ? passport.project
            : HostedXpenserPassportDefaults.project,
        environment: present(passport.environment)
            ? passport.environment
            : HostedXpenserPassportDefaults.environment
    };
}
