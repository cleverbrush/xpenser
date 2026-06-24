import { webConfig } from './config';

export function publicAppUrl(path = '/') {
    return new URL(path, webConfig.appUrl);
}

export function configureAuthPublicUrl() {
    // Auth.js reads these internally when constructing action and error URLs.
    const authUrl = publicAppUrl('/authjs').toString().replace(/\/$/, '');
    process.env.AUTH_URL = authUrl;
    process.env.NEXTAUTH_URL = authUrl;
}
