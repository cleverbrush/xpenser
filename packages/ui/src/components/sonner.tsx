'use client';

import {
    CircleCheckIcon,
    InfoIcon,
    Loader2Icon,
    OctagonXIcon,
    TriangleAlertIcon
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps, toast } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    const { theme = 'system' } = useTheme();

    return (
        <Sonner
            className="toaster group"
            duration={4_000}
            icons={{
                success: <CircleCheckIcon className="size-4" />,
                info: <InfoIcon className="size-4" />,
                warning: <TriangleAlertIcon className="size-4" />,
                error: <OctagonXIcon className="size-4" />,
                loading: <Loader2Icon className="size-4 animate-spin" />
            }}
            position="bottom-right"
            style={
                {
                    '--normal-bg': 'hsl(var(--popover))',
                    '--normal-text': 'hsl(var(--popover-foreground))',
                    '--normal-border': 'hsl(var(--border))',
                    '--border-radius': 'var(--radius)'
                } as React.CSSProperties
            }
            theme={theme as ToasterProps['theme']}
            {...props}
        />
    );
}

export { Toaster, toast };
