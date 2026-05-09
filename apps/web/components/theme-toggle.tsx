'use client';

import { Button } from '@xpenser/ui';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    return (
        <Button
            aria-label="Toggle theme"
            onClick={() => setTheme(nextTheme)}
            size="icon-sm"
            type="button"
            variant="ghost"
        >
            {resolvedTheme === 'dark' ? (
                <SunIcon data-icon="inline-start" />
            ) : (
                <MoonIcon data-icon="inline-start" />
            )}
        </Button>
    );
}
