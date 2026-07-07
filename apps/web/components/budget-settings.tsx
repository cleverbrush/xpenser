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
    CardTitle,
    Input
} from '@xpenser/ui';
import { SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { BudgetCurrencyFields } from '@/components/budget-currency-fields';
import {
    archiveBudgetAction,
    createBudgetAction,
    deleteBudgetAction,
    inviteBudgetMemberAction,
    removeBudgetMemberAction,
    restoreBudgetAction,
    updateBudgetAction,
    updateBudgetMemberAction
} from '@/lib/actions';

const permissionOptions = [
    ['canCreateTransactions', 'Add transactions', true],
    ['canUpdateTransactions', 'Edit transactions', false],
    ['canDeleteTransactions', 'Delete transactions', false],
    ['canManageCategories', 'Manage categories', false],
    ['canManageVendors', 'Manage vendors', false],
    ['canManageTags', 'Manage tags', false],
    ['canManageMembers', 'Manage members', false]
] as const;

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
                <form
                    action={createBudgetAction}
                    className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto] sm:items-end"
                >
                    <label
                        className="grid gap-1 text-sm"
                        htmlFor="new-budget-name"
                    >
                        <span className="font-medium">Name</span>
                        <Input
                            id="new-budget-name"
                            maxLength={120}
                            name="name"
                            placeholder="Shared household"
                            required
                        />
                    </label>
                    <BudgetCurrencyFields
                        currencies={currencies}
                        defaultCurrency={defaultCurrency}
                        idPrefix="new-budget"
                        selectedCurrencies={[]}
                    />
                    <Button type="submit">Create</Button>
                </form>

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

function BudgetNameForm({ budget }: { readonly budget: Budget }) {
    return (
        <form
            action={updateBudgetAction}
            className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-end"
        >
            <input name="budgetId" type="hidden" value={budget.id} />
            <label className="grid gap-1 text-sm" htmlFor="budget-name">
                <span className="font-medium">My budget name</span>
                <Input
                    defaultValue={budget.name}
                    id="budget-name"
                    maxLength={120}
                    name="name"
                    required
                />
            </label>
            <Button type="submit">Rename</Button>
        </form>
    );
}

function BudgetCurrencyForm({
    budget,
    currencies
}: {
    readonly budget: Budget;
    readonly currencies: readonly Currency[];
}) {
    return (
        <form
            action={updateBudgetAction}
            className="grid gap-3 rounded-md border p-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-end"
        >
            <input name="budgetId" type="hidden" value={budget.id} />
            <BudgetCurrencyFields
                currencies={currencies}
                defaultCurrency={budget.defaultCurrency}
                idPrefix={`budget-${budget.id}`}
                selectedCurrencies={budget.favoriteCurrencies}
            />
            <Button type="submit">Save currencies</Button>
        </form>
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

function PermissionCheckboxes({
    member
}: {
    readonly member?: Pick<BudgetMember, 'permissions'>;
}) {
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {permissionOptions.map(([key, label, defaultChecked]) => (
                <label className="flex items-center gap-2 text-sm" key={key}>
                    <input
                        defaultChecked={
                            member?.permissions[key] ?? defaultChecked
                        }
                        name={key}
                        type="checkbox"
                        value="true"
                    />
                    <span>{label}</span>
                </label>
            ))}
        </div>
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
            <form
                action={updateBudgetMemberAction}
                className="grid gap-3 sm:grid-cols-[9rem_1fr_auto] sm:items-start"
            >
                <input name="budgetId" type="hidden" value={budgetId} />
                <input name="userId" type="hidden" value={row.userId} />
                <label className="grid gap-1 text-sm">
                    <span className="font-medium">Role</span>
                    <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        defaultValue={row.role}
                        name="role"
                    >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                    </select>
                </label>
                <PermissionCheckboxes member={row} />
                <Button type="submit">Update</Button>
            </form>
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

function InviteForm({ budget }: { readonly budget: Budget }) {
    return (
        <form
            action={inviteBudgetMemberAction}
            className="grid gap-3 rounded-md border p-3"
        >
            <input name="budgetId" type="hidden" value={budget.id} />
            <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
                <label className="grid gap-1 text-sm" htmlFor="invite-email">
                    <span className="font-medium">Invite email</span>
                    <Input
                        id="invite-email"
                        name="email"
                        placeholder="teammate@example.com"
                        required
                        type="email"
                    />
                </label>
                <label className="grid gap-1 text-sm">
                    <span className="font-medium">Role</span>
                    <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        defaultValue="member"
                        name="role"
                    >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                    </select>
                </label>
                <Button type="submit">Invite</Button>
            </div>
            <PermissionCheckboxes />
        </form>
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
                    <BudgetNameForm budget={budget} />
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
                        <BudgetCurrencyForm
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
                        {editable ? <InviteForm budget={budget} /> : null}
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
