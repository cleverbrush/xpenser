import {
    any,
    boolean,
    number,
    object,
    parseString,
    string
} from '@cleverbrush/schema';

export const AuthErrorLogged = parseString(
    object({ AuthErrorType: string(), AuthErrorMessage: string() }),
    $t => $t`Auth.js error ${t => t.AuthErrorType}`
);

export const AuthWarningLogged = parseString(
    object({ AuthWarningCode: string() }),
    $t => $t`Auth.js warning ${t => t.AuthWarningCode}`
);

export const AuthDebugLogged = parseString(
    object({ AuthDebugMessage: string(), AuthDebugMetadata: any().optional() }),
    $t => $t`Auth.js debug ${t => t.AuthDebugMessage}`
);

export const InvalidCheckSignOut = parseString(
    object({ AuthErrorType: string(), Url: string() }),
    $t =>
        $t`Signing out after Auth.js ${t => t.AuthErrorType} and redirecting to login`
);

export const VendorUpdateActionRejected = parseString(
    object({
        ApiMessage: string().optional(),
        ApiStatus: number(),
        DescriptionLength: number(),
        DomainLength: number(),
        LocalSchemaError: string().optional(),
        LocalSchemaValid: boolean(),
        LogoUrlFormatValid: boolean(),
        LogoUrlLength: number(),
        NameLength: number(),
        PrimaryColorFormatValid: boolean(),
        PrimaryColorLength: number(),
        VendorId: number()
    }),
    $t =>
        $t`Vendor ${t => t.VendorId} update rejected by web action with status ${t => t.ApiStatus}`
);
