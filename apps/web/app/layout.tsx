import { XpenserFormProvider } from '@xpenser/ui';
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
    title: 'xpenser',
    description: 'Personal income and expense tracking'
};

export default function RootLayout({
    children
}: {
    readonly children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
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
