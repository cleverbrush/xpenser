'use client';

import { Button } from '@xpenser/ui';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

export type DashboardExpansionAction = {
    readonly allExpanded: boolean;
    readonly onToggle: () => void;
};

export function DashboardExpansionButton({
    action,
    target
}: {
    readonly action: DashboardExpansionAction;
    readonly target: string;
}) {
    const label = `${action.allExpanded ? 'Collapse' : 'Expand'} all ${target}`;
    const Icon = action.allExpanded ? ChevronRightIcon : ChevronDownIcon;

    return (
        <Button
            aria-label={label}
            className="size-8 shrink-0 rounded-sm"
            onClick={action.onToggle}
            size="icon-sm"
            title={label}
            type="button"
            variant="ghost"
        >
            <Icon aria-hidden className="size-4" />
        </Button>
    );
}
