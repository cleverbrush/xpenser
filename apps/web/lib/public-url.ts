import { webConfig } from './config';

export function publicAppUrl(path = '/') {
    return new URL(path, webConfig.appUrl);
}

export function configureAuthPublicUrl() {
    // Auth.js reads these internally when constructing action and error URLs.
    process.env.AUTH_URL = webConfig.appUrl;
    process.env.NEXTAUTH_URL = webConfig.appUrl;
}
