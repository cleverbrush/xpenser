import { ActionResult } from '@cleverbrush/server';

export const webServiceSecretHeader = 'x-xpenser-web-secret';

export function accountAuthDisabled(config: {
    readonly singleUser?: { readonly enabled: boolean };
}) {
    if (!config.singleUser?.enabled) {
        return undefined;
    }

    return ActionResult.unauthorized({
        message: 'Account authentication is disabled in single-user mode.'
    });
}
