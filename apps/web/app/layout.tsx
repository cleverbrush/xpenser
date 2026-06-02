import { GoogleTagManager } from '@next/third-parties/google';
import type { Metadata } from 'next';
import './globals.css';
import { XpenserWebFormProvider } from '@/components/forms/schema-fields';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
    title: 'xpenser',
    description:
        'Personal finance tracking and Cleverbrush Framework demonstrator'
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
