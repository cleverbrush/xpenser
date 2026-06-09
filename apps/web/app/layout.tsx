import { GoogleTagManager } from '@next/third-parties/google';
import type { Metadata } from 'next';
import './globals.css';
import { XpenserWebFormProvider } from '@/components/forms/schema-fields';
import { ThemeProvider } from '@/components/theme-provider';

const publicUrl = process.env.APP_URL ?? 'https://xpenser.cleverbrush.com';
const description =
    'Open-source, self-hostable personal finance tracking for replacing spreadsheets with dashboards, reports, API keys, and MCP access.';

export const metadata: Metadata = {
    metadataBase: new URL(publicUrl),
    applicationName: 'xpenser',
    title: {
        default: 'xpenser',
        template: '%s | xpenser'
    },
    description,
    openGraph: {
        type: 'website',
        url: '/',
        siteName: 'xpenser',
        title: 'xpenser - open-source personal finance tracker',
        description,
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'xpenser personal finance app preview'
            }
        ]
    },
    twitter: {
        card: 'summary_large_image',
        title: 'xpenser - open-source personal finance tracker',
        description,
        images: ['/og-image.png']
    }
};

export default function RootLayout({
    children
}: {
    readonly children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <GoogleTagManager gtmId="GTM-WRLXDMG" />
            <body>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    <XpenserWebFormProvider>{children}</XpenserWebFormProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
