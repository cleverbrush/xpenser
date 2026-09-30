import { ActionResult } from '@cleverbrush/server';
import {
    VendorMetadataError,
    VendorNameError,
    VendorNotFoundError
} from '../../../application/vendors.js';
import { budgetAccessErrors } from '../../errors/budget-access.js';

/** Preserve the expected errors handled by vendors.get. */
export const getErrors = budgetAccessErrors.on(VendorNotFoundError, err =>
    ActionResult.notFound({ message: err.message })
);

/** Preserve the expected errors handled by vendors.create. */
export const createErrors = budgetAccessErrors.on(VendorNameError, err =>
    ActionResult.badRequest({ message: err.message })
);

/** Preserve the expected errors handled by vendors.update. */
export const updateErrors = budgetAccessErrors
    .on(VendorNotFoundError, err =>
        ActionResult.notFound({ message: err.message })
    )
    .on(VendorNameError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(VendorMetadataError, err =>
        ActionResult.badRequest({ message: err.message })
    );
