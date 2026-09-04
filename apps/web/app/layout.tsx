import { Toaster } from '@xpenser/ui';
import type { Metadata } from 'next';
import 'swagger-ui-dist/swagger-ui.css';
import './globals.css';
import { XpenserWebFormProvider } from '@/components/forms/schema-fields';
import { GoogleTagManager } from '@/components/google-tag-manager';
import { ThemeProvider } from '@/components/theme-provider';
import { webConfig } from '@/lib/config';
import {
    getPublicMarketingPage,
    publicSiteOrigin,
    publicUrl
} from '@/lib/public-site';

const homePage = getPublicMarketingPage('/');

export const metadata: Metadata = {
    metadataBase: new URL(publicSiteOrigin),
    applicationName: 'xpenser',
    title: {
        default: 'xpenser - self-hosted personal finance tracking',
        template: '%s | xpenser'
    },
    description: homePage.description,
    openGraph: {
        type: 'website',
        url: publicUrl('/'),
        siteName: 'xpenser',
        title: 'xpenser - self-hosted personal finance tracking',
        description: homePage.description,
        images: [
            {
                url: publicUrl('/og-image.png'),
                width: 1200,
                height: 630,
                alt: 'xpenser personal finance app preview'
            }
        ]
    },
    twitter: {
        card: 'summary_large_image',
        title: 'xpenser - self-hosted personal finance tracking',
        description: homePage.description,
        images: [publicUrl('/og-image.png')]
    }
};

export default function RootLayout({
    children
}: {
    readonly children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            {webConfig.disableGtm || webConfig.singleUser.enabled ? null : (
                <GoogleTagManager gtmId="GTM-WRLXDMG" />
            )}
            <body>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    <XpenserWebFormProvider>{children}</XpenserWebFormProvider>
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
