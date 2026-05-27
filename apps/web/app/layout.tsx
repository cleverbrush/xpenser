import { GoogleTagManager } from '@next/third-parties/google';
import { XpenserFormProvider } from '@xpenser/ui';
import type { Metadata } from 'next';
import './globals.css';
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
            <GoogleTagManager gtmId="GTM-PSC6NS8P" />
            <body>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    <XpenserFormProvider>{children}</XpenserFormProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
