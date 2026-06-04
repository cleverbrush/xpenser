import type { Vendor } from '@xpenser/contracts';
import { Avatar, AvatarFallback, AvatarImage } from '@xpenser/ui';

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
