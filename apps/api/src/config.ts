import { config as sharedConfig } from '@xpenser/contract/config';

/** Re-export the shared configuration from @xpenser/contract. */
export const config = sharedConfig;
export type Config = typeof config;
