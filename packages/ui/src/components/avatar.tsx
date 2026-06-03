'use client';

import * as React from 'react';
import { cn } from '../lib/utils.js';

export function Avatar({
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cn(
                'relative flex size-8 shrink-0 overflow-hidden rounded-full bg-muted',
                className
            )}
            {...props}
        />
    );
}

export function AvatarImage({
    alt = '',
    className,
    onError,
    onLoad,
    src,
    ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
    const [failedSrc, setFailedSrc] = React.useState<string>();

    if (failedSrc === src || !src) {
        return null;
    }

    return (
        <img
            className={cn(
                'pointer-events-none absolute inset-0 z-10 size-full object-cover',
                className
            )}
            alt={alt}
            onError={event => {
                setFailedSrc(src);
                onError?.(event);
            }}
            onLoad={onLoad}
            src={src}
            {...props}
        />
    );
}

export function AvatarFallback({
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cn(
                'flex size-full items-center justify-center rounded-full text-xs font-medium text-muted-foreground',
                className
            )}
            {...props}
        />
    );
}
