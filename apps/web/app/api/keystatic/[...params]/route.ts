import { makeRouteHandler } from '@keystatic/next/route-handler';
import keystaticConfig, { isKeystaticAdminEnabled } from '@/keystatic.config';

export async function GET(request: Request): Promise<Response> {
    if (!isKeystaticAdminEnabled) {
        return notFoundResponse();
    }

    return createRouteHandler().GET(request);
}

export async function POST(request: Request): Promise<Response> {
    if (!isKeystaticAdminEnabled) {
        return notFoundResponse();
    }

    return createRouteHandler().POST(request);
}

function notFoundResponse(): Response {
    return new Response('Not found', { status: 404 });
}

function createRouteHandler() {
    return makeRouteHandler({
        config: keystaticConfig,
        clientId: process.env.KEYSTATIC_GITHUB_CLIENT_ID,
        clientSecret: process.env.KEYSTATIC_GITHUB_CLIENT_SECRET,
        secret: process.env.KEYSTATIC_SECRET
    });
}
