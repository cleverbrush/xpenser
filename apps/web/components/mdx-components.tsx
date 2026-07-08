import Image from 'next/image';
import Link from 'next/link';
import type { ComponentProps } from 'react';

export const mdxComponents = {
    a: MdxLink,
    code: (props: ComponentProps<'code'>) => (
        <code
            className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground"
            {...props}
        />
    ),
    figcaption: (props: ComponentProps<'figcaption'>) => (
        <figcaption
            className="mt-3 text-sm leading-6 text-muted-foreground"
            {...props}
        />
    ),
    figure: (props: ComponentProps<'figure'>) => (
        <figure className="my-8" {...props} />
    ),
    h2: (props: ComponentProps<'h2'>) => (
        <h2 className="pt-4 text-2xl font-semibold leading-tight" {...props} />
    ),
    h3: (props: ComponentProps<'h3'>) => (
        <h3 className="pt-2 text-xl font-semibold leading-tight" {...props} />
    ),
    img: MdxImage,
    li: (props: ComponentProps<'li'>) => (
        <li className="pl-1 leading-7" {...props} />
    ),
    ol: (props: ComponentProps<'ol'>) => (
        <ol className="ml-5 list-decimal space-y-2" {...props} />
    ),
    p: (props: ComponentProps<'p'>) => (
        <p className="leading-8 text-muted-foreground" {...props} />
    ),
    pre: (props: ComponentProps<'pre'>) => (
        <pre
            className="overflow-x-auto rounded-lg border bg-muted/50 p-4 text-sm"
            {...props}
        />
    ),
    ul: (props: ComponentProps<'ul'>) => (
        <ul className="ml-5 list-disc space-y-2" {...props} />
    )
} as const;

function MdxImage({ alt, src, title }: ComponentProps<'img'>) {
    if (typeof src !== 'string') {
        return null;
    }

    return (
        <Image
            alt={alt ?? ''}
            className="h-auto w-full rounded-lg border bg-background"
            height={900}
            loading="lazy"
            sizes="(min-width: 768px) 768px, 100vw"
            src={src}
            title={title}
            width={1440}
        />
    );
}

function MdxLink({ href, ...props }: ComponentProps<'a'>) {
    const className =
        'font-medium text-primary underline-offset-4 hover:underline';

    if (href?.startsWith('/')) {
        return <Link className={className} href={href} {...props} />;
    }

    return (
        <a
            className={className}
            href={href}
            rel="noreferrer"
            target="_blank"
            {...props}
        />
    );
}
