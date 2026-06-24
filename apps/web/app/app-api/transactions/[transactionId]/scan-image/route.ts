import { createXpenserClient } from '@xpenser/client';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { webConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
    readonly params:
        | { readonly transactionId: string }
        | Promise<{ readonly transactionId: string }>;
};

function isApiErrorStatus(err: unknown, status: number): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        err.status === status
    );
}

function parseTransactionId(value: string): number | undefined {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function contentDisposition(fileName?: string | null): string {
    const safeName =
        fileName
            ?.replace(/[^a-zA-Z0-9._-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 120) || 'scanned-transaction-image';
    return `inline; filename="${safeName}"`;
}

export async function GET(_request: NextRequest, context: RouteContext) {
    const { transactionId } = await Promise.resolve(context.params);
    const id = parseTransactionId(transactionId);
    if (!id) {
        return NextResponse.json(
            { message: 'Transaction was not found.' },
            { status: 404 }
        );
    }

    const session = await auth();
    if (!session?.apiToken) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const client = createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        getToken: () => session.apiToken,
        retryOnTimeout: false,
        timeoutMs: 30_000
    });

    try {
        const image = await client.transactions.scanImage({
            params: { id }
        });
        const buffer = Buffer.from(image.imageBase64, 'base64');
        return new NextResponse(buffer, {
            headers: {
                'Cache-Control': 'private, no-store',
                'Content-Disposition': contentDisposition(image.fileName),
                'Content-Length': String(buffer.byteLength),
                'Content-Type': image.mimeType
            }
        });
    } catch (err) {
        if (isApiErrorStatus(err, 401)) {
            return NextResponse.json(
                { message: 'Session expired.' },
                { status: 401 }
            );
        }
        if (isApiErrorStatus(err, 404)) {
            return NextResponse.json(
                { message: 'Scanned image was not found.' },
                { status: 404 }
            );
        }
        throw err;
    }
}
