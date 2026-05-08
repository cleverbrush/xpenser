import type { Metadata } from 'next';
import { ThemeProvider } from '@xpenser/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'Xpenser',
  description: 'Personal income and expense tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider defaultTheme="system">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
