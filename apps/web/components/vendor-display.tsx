import type { Vendor } from '@xpenser/contracts';
import { Avatar, AvatarFallback, AvatarImage, Badge } from '@xpenser/ui';

export function vendorDisplayName(vendor: Vendor): string {
    return vendor.displayName || vendor.resolvedName || vendor.name;
}

function classNames(...values: Array<string | undefined>) {
    return values.filter(Boolean).join(' ');
}

export function VendorLogo({
    className,
    vendor,
    size = 'md'
}: {
    readonly className?: string;
    readonly vendor: Pick<Vendor, 'displayName' | 'logoUrl' | 'name'>;
    readonly size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
    const label = vendor.displayName || vendor.name;
    const sizeClassName = {
        xs: 'size-4',
        sm: 'size-6',
        md: 'size-8',
        lg: 'size-16'
    }[size];
    const fallbackTextClassName = {
        xs: 'text-[9px]',
        sm: 'text-[10px]',
        md: 'text-xs',
        lg: 'text-xl'
    }[size];

    return (
        <Avatar
            aria-hidden
            className={classNames(
                sizeClassName,
                'rounded-sm bg-muted',
                className
            )}
        >
            <AvatarImage
                alt=""
                className="object-contain"
                src={vendor.logoUrl ?? undefined}
            />
            <AvatarFallback
                className={classNames('rounded-sm', fallbackTextClassName)}
            >
                {label.slice(0, 1).toUpperCase()}
            </AvatarFallback>
        </Avatar>
    );
}

export function enrichmentStatusLabel(
    status: Vendor['enrichmentStatus']
): string {
    switch (status) {
        case 'success':
            return 'Enriched';
        case 'not_found':
            return 'No match';
        case 'failed':
            return 'Failed';
        case 'disabled':
            return 'Disabled';
        default:
            return 'Not enriched';
    }
}

export function EnrichmentStatusBadge({
    status
}: {
    readonly status: Vendor['enrichmentStatus'];
}) {
    const className =
        status === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
            : status === 'failed'
              ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200'
              : status === 'not_found'
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
                : undefined;

    return (
        <Badge className={className} variant="outline">
            {enrichmentStatusLabel(status)}
        </Badge>
    );
}
