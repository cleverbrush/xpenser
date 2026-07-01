import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AlternativeProductPage } from '@/components/alternatives-pages';
import { JsonLdScript } from '@/components/json-ld';
import {
    createAlternativeProductJsonLd,
    createAlternativeProductMetadata
} from '@/lib/alternative-seo';
import { alternativeProducts, getAlternativeProduct } from '@/lib/alternatives';
import { webConfig } from '@/lib/config';

type AlternativeRouteProps = {
    readonly params: Promise<{
        readonly slug: string;
    }>;
};

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
    return alternativeProducts.map(product => ({ slug: product.slug }));
}

export async function generateMetadata({
    params
}: AlternativeRouteProps): Promise<Metadata> {
    const { slug } = await params;
    const product = getAlternativeProduct(slug);

    if (!product) {
        return {};
    }

    return createAlternativeProductMetadata(product);
}

export default async function AlternativeRoutePage({
    params
}: AlternativeRouteProps) {
    if (webConfig.singleUser?.enabled) {
        redirect('/dashboard');
    }

    const { slug } = await params;
    const product = getAlternativeProduct(slug);

    if (!product) {
        notFound();
    }

    return (
        <>
            <JsonLdScript data={createAlternativeProductJsonLd(product)} />
            <AlternativeProductPage product={product} />
        </>
    );
}
