import { redirect } from 'next/navigation';
import { AlternativesIndexPage } from '@/components/alternatives-pages';
import { JsonLdScript } from '@/components/json-ld';
import {
    createAlternativesIndexJsonLd,
    createAlternativesIndexMetadata
} from '@/lib/alternative-seo';
import { webConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const metadata = createAlternativesIndexMetadata();

export default function AlternativesRoutePage() {
    if (webConfig.singleUser?.enabled) {
        redirect('/dashboard');
    }

    return (
        <>
            <JsonLdScript data={createAlternativesIndexJsonLd()} />
            <AlternativesIndexPage />
        </>
    );
}
