'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="class" defaultTheme={defaultTheme} enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}

export { useTheme } from 'next-themes';
