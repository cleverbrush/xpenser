/**
 * Persisted text-field limits shared by contracts, UI inputs, and database
 * migrations.
 *
 * Keeping these values in the contracts package prevents form max lengths,
 * Cleverbrush schema validation, and database column sizes from drifting.
 */
export const FieldLimits = {
    apiKeyName: 120,
    brandfetchBrandId: 100,
    categoryName: 120,
    confirmationToken: 128,
    email: 255,
    passportAuthorizationCode: 2048,
    passportAvatarUrl: 1000,
    passportDisplayName: 160,
    passportProvider: 50,
    passportSubject: 255,
    password: 256,
    telegramFirstName: 128,
    telegramLastName: 128,
    telegramLinkToken: 128,
    telegramUserId: 64,
    telegramUsername: 64,
    timeZone: 64,
    transactionTagName: 60,
    transactionTagSearch: 160,
    transactionNote: 2000,
    transactionSearch: 500,
    vendorDescription: 1000,
    vendorDomain: 255,
    vendorLogoUrl: 1000,
    vendorName: 160,
    vendorPrimaryColor: 7,
    vendorSearch: 160
} as const;

export const TransactionTagLimits = {
    maxTagsPerTransaction: 12
} as const;

/**
 * Limits for multimodal transaction scan uploads and generated scan drafts.
 */
export const TransactionScanLimits = {
    maxImageBytes: 10 * 1024 * 1024,
    uploadChunkBytes: 384 * 1024
} as const;
