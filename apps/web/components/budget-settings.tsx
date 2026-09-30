import type {
    Budget,
    BudgetAccessRow,
    BudgetMember,
    Currency
} from '@xpenser/contracts';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import {
    archiveBudgetAction,
    deleteBudgetAction,
    removeBudgetMemberAction,
    restoreBudgetAction
} from '@/lib/actions';
import { permissionOptions } from '@/lib/budget-permissions';
import {
    BudgetCreateForm,
    BudgetEditForm,
    BudgetMemberForm
} from './forms/budget-forms';

function roleLabel(role: Budget['role']) {
    return role === 'admin' ? 'Admin' : 'Member';
}

function permissionSummary(member: Pick<BudgetMember, 'permissions' | 'role'>) {
    if (member.role === 'admin') {
        return 'Full access';
    }
    const enabled = permissionOptions
        .filter(([key]) => member.permissions[key])
        .map(([, label]) => label);
    return enabled.length > 0 ? enabled.join(', ') : 'View only';
}

function BudgetBadges({ budget }: { readonly budget: Budget }) {
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate font-medium">{budget.name}</h3>
            <Badge variant="outline">{roleLabel(budget.role)}</Badge>
            {budget.isMain ? <Badge>Main</Badge> : null}
            {budget.archivedAt ? (
                <Badge variant="outline">Archived</Badge>
            ) : null}
        </div>
    );
}

function BudgetDetails({ budget }: { readonly budget: Budget }) {
    const currencies = [budget.defaultCurrency, ...budget.favoriteCurrencies];
    return (
        <p className="mt-1 text-sm text-muted-foreground">
            {currencies.join(', ')}
        </p>
    );
}

function BudgetOverviewRow({ budget }: { readonly budget: Budget }) {
    return (
        <article className="rounded-md border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <BudgetBadges budget={budget} />
                    <BudgetDetails budget={budget} />
                </div>
                <Button asChild size="sm" variant="outline">
                    <Link href={`/settings/budgets/${budget.id}`}>
                        <SettingsIcon aria-hidden className="size-4" />
                        Manage
                    </Link>
                </Button>
            </div>
        </article>
    );
}

export function BudgetSettings({
    archivedBudgets,
    budgets,
    currencies
}: {
    readonly archivedBudgets: readonly Budget[];
    readonly budgets: readonly Budget[];
    readonly currencies: readonly Currency[];
}) {
    const defaultCurrency =
        budgets.find(budget => budget.isMain)?.defaultCurrency ??
        budgets[0]?.defaultCurrency ??
        'USD';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Budgets</CardTitle>
                <CardDescription>
                    Separate transaction spaces and invite other users to shared
                    budgets.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <BudgetCreateForm
                    currencies={currencies}
                    defaultCurrency={defaultCurrency}
                />

                <div className="space-y-3">
                    {budgets.map(budget => (
                        <BudgetOverviewRow budget={budget} key={budget.id} />
                    ))}
                </div>

                {archivedBudgets.length > 0 ? (
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium">
                            Archived budgets
                        </h3>
                        {archivedBudgets.map(budget => (
                            <BudgetOverviewRow
                                budget={budget}
                                key={budget.id}
                            />
                        ))}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

function LifecycleActions({ budget }: { readonly budget: Budget }) {
    if (budget.isMain) {
        return null;
    }
    if (budget.archivedAt) {
        return (
            <div className="flex flex-col gap-2 sm:flex-row">
                <form action={restoreBudgetAction}>
                    <input name="budgetId" type="hidden" value={budget.id} />
                    <Button
                        className="w-full sm:w-auto"
                        type="submit"
                        variant="outline"
                    >
                        Restore
                    </Button>
                </form>
                <form action={deleteBudgetAction}>
                    <input name="budgetId" type="hidden" value={budget.id} />
                    <Button
                        className="w-full sm:w-auto"
                        type="submit"
                        variant="destructive"
                    >
                        Delete
                    </Button>
                </form>
            </div>
        );
    }
    return (
        <form action={archiveBudgetAction}>
            <input name="budgetId" type="hidden" value={budget.id} />
            <Button
                className="w-full sm:w-auto"
                type="submit"
                variant="outline"
            >
                Archive
            </Button>
        </form>
    );
}

function ActiveAccessRow({
    budgetId,
    currentUserId,
    row
}: {
    readonly budgetId: number;
    readonly currentUserId: number;
    readonly row: Extract<BudgetAccessRow, { readonly status: 'active' }>;
}) {
    return (
        <div className="grid gap-3 rounded-md border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.email}</p>
                    <p className="text-xs text-muted-foreground">
                        {roleLabel(row.role)} - {permissionSummary(row)}
                    </p>
                </div>
                <Badge variant="outline">Active</Badge>
            </div>
            <BudgetMemberForm budgetId={budgetId} member={row} />
            {row.userId === currentUserId ? null : (
                <form action={removeBudgetMemberAction}>
                    <input name="budgetId" type="hidden" value={budgetId} />
                    <input name="userId" type="hidden" value={row.userId} />
                    <Button size="sm" type="submit" variant="outline">
                        Remove user
                    </Button>
                </form>
            )}
        </div>
    );
}

function InvitationAccessRow({
    row
}: {
    readonly row: Extract<
        BudgetAccessRow,
        { readonly status: 'pending' | 'expired' | 'accepted' }
    >;
}) {
    return (
        <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.email}</p>
                <p className="text-xs text-muted-foreground">
                    {roleLabel(row.role)} - {permissionSummary(row)}
                </p>
            </div>
            <Badge variant="outline">
                {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
            </Badge>
        </div>
    );
}

function AccessList({
    accessRows,
    budgetId,
    currentUserId
}: {
    readonly accessRows: readonly BudgetAccessRow[];
    readonly budgetId: number;
    readonly currentUserId: number;
}) {
    return (
        <div className="space-y-2">
            {accessRows.map(row =>
                row.status === 'active' ? (
                    <ActiveAccessRow
                        budgetId={budgetId}
                        currentUserId={currentUserId}
                        key={`active-${row.userId}`}
                        row={row}
                    />
                ) : (
                    <InvitationAccessRow
                        key={`invitation-${row.invitationId}`}
                        row={row}
                    />
                )
            )}
        </div>
    );
}

export function BudgetDetailSettings({
    accessRows,
    budget,
    currencies,
    currentUserId
}: {
    readonly accessRows: readonly BudgetAccessRow[];
    readonly budget: Budget;
    readonly currencies: readonly Currency[];
    readonly currentUserId: number;
}) {
    const canManage = budget.permissions.canManageMembers;
    const editable = canManage && !budget.archivedAt;

    return (
        <div className="space-y-5 sm:space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <BudgetBadges budget={budget} />
                            <BudgetDetails budget={budget} />
                        </div>
                        {canManage ? (
                            <LifecycleActions budget={budget} />
                        ) : null}
                    </div>
                </CardHeader>
                <CardContent>
                    <BudgetEditForm budget={budget} />
                </CardContent>
            </Card>

            {editable ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Budget currencies</CardTitle>
                        <CardDescription>
                            Set the primary reporting currency and quick-pick
                            currencies for this budget.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <BudgetEditForm
                            budget={budget}
                            currencies={currencies}
                        />
                    </CardContent>
                </Card>
            ) : null}

            {canManage ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Access</CardTitle>
                        <CardDescription>
                            Manage active users and review invitation statuses.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <AccessList
                            accessRows={accessRows}
                            budgetId={budget.id}
                            currentUserId={currentUserId}
                        />
                        {editable ? (
                            <BudgetMemberForm budgetId={budget.id} />
                        ) : null}
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
