import { type NextRequest, NextResponse } from 'next/server';
import { webConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ProxyContext = {
    readonly params:
        | { readonly path: readonly string[] }
        | Promise<{ readonly path: readonly string[] }>;
};

const hopByHopHeaders = new Set([
    'connection',
    'content-length',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade'
]);

function apiPath(parts: readonly string[]): string {
    const path = parts.join('/');
    if (path === '.well-known' || path.startsWith('.well-known/')) {
        return `/${path}`;
    }
    if (path === 'health' || path === 'openapi.json' || path === '__batch') {
        return `/${path}`;
    }
    if (path.startsWith('api/')) {
        return `/${path}`;
    }
    return `/api/${path}`;
}

function targetUrl(request: NextRequest, parts: readonly string[]): string {
    const baseUrl = new URL(webConfig.apiBaseUrl);
    const target = new URL(apiPath(parts), baseUrl);
    target.search = request.nextUrl.search;
    return target.toString();
}

function proxyRequestHeaders(request: NextRequest): Headers {
    const headers = new Headers(request.headers);
    for (const header of hopByHopHeaders) {
        headers.delete(header);
    }
    headers.set('x-forwarded-host', request.headers.get('host') ?? '');
    headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
    return headers;
}

function proxyResponseHeaders(response: Response): Headers {
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    return headers;
}

async function proxy(request: NextRequest, context: ProxyContext) {
    const { path } = await Promise.resolve(context.params);
    const method = request.method.toUpperCase();
    const body =
        method === 'GET' || method === 'HEAD'
            ? undefined
            : await request.arrayBuffer();

    const response = await fetch(targetUrl(request, path), {
        method,
        headers: proxyRequestHeaders(request),
        body
    });

    return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: proxyResponseHeaders(response)
    });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
