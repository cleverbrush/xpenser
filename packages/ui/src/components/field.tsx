import type * as React from 'react';
import { cn } from '../lib/utils.js';

export function FieldGroup({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex flex-col gap-4', className)} {...props} />;
}

export function Field({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex flex-col gap-2', className)} {...props} />;
}

export function FieldSet({
    className,
    ...props
}: React.FieldsetHTMLAttributes<HTMLFieldSetElement>) {
    return (
        <fieldset className={cn('flex flex-col gap-3', className)} {...props} />
    );
}

export function FieldLegend({
    className,
    ...props
}: React.HTMLAttributes<HTMLLegendElement>) {
    return (
        <legend className={cn('text-sm font-medium', className)} {...props} />
    );
}

export function FieldLabel({
    className,
    ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
    return (
        // biome-ignore lint/a11y/noLabelWithoutControl: this is a composable label primitive.
        <label className={cn('text-sm font-medium', className)} {...props} />
    );
}

export function FieldDescription({
    className,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p
            className={cn('text-sm text-muted-foreground', className)}
            {...props}
        />
    );
}

export function FieldError({
    className,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p
            className={cn('text-sm font-medium text-destructive', className)}
            {...props}
        />
    );
}
