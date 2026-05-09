import { LoaderCircleIcon } from 'lucide-react';
import { cn } from '../lib/utils.js';

export function Spinner({ className }: { readonly className?: string }) {
    return (
        <LoaderCircleIcon
            aria-hidden="true"
            className={cn('animate-spin', className)}
            data-icon="inline-start"
        />
    );
}
