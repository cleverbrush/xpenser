import { ActionResult, type Handler } from '@cleverbrush/server';
import { updateUserPreference } from '../../../../application/users.js';
import type { usersScope } from '../scope.js';

/** Update preferences. */
export const updatePreferencesHandler: Handler<
    typeof usersScope.endpoints.updatePreferences
> = async ({ body, principal }, { db }) => {
    const preference = await updateUserPreference(
        db,
        principal.userId,
        body.countryCode,
        body.timezone,
        body.weeklyEmailReportEnabled,
        body.monthlyEmailReportEnabled
    );
    if (!preference) {
        return ActionResult.unauthorized({ message: 'User was not found.' });
    }
    return preference;
};
