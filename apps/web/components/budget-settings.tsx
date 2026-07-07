import type { Budget, BudgetMember, Currency } from '@xpenser/contracts';
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
import {
    archiveBudgetAction,
    createBudgetAction,
    deleteBudgetAction,
    inviteBudgetMemberAction,
    removeBudgetMemberAction,
    restoreBudgetAction,
    updateBudgetAction
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

function permissionSummary(member: BudgetMember): string {
    if (member.role === 'admin') {
        return 'Full access';
    }
    const enabled = permissionOptions
        .filter(([key]) => member.permissions[key])
        .map(([, label]) => label);
    return enabled.length > 0 ? enabled.join(', ') : 'View only';
}

function isMainName(name: string): boolean {
    return name.trim().replace(/\s+/g, ' ').toLowerCase() === 'main';
}

function CurrencySelect({
    currencies,
    defaultValue,
    label
}: {
    readonly currencies: readonly Currency[];
    readonly defaultValue: string;
    readonly label: string;
}) {
    return (
        <label className="grid gap-1 text-sm">
            <span className="font-medium">{label}</span>
            <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                defaultValue={defaultValue}
                name="defaultCurrency"
            >
                {currencies.map(currency => (
                    <option key={currency.code} value={currency.code}>
                        {currency.code}
                    </option>
                ))}
            </select>
        </label>
    );
}

function BudgetBadges({ budget }: { readonly budget: Budget }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{budget.name}</h3>
            <Badge variant="outline">{roleLabel(budget.role)}</Badge>
            {budget.isMain ? <Badge>Main</Badge> : null}
            {budget.archivedAt ? (
                <Badge variant="outline">Archived</Badge>
            ) : null}
        </div>
    );
}

function BudgetDetails({ budget }: { readonly budget: Budget }) {
    return (
        <p className="mt-1 text-sm text-muted-foreground">
            {budget.defaultCurrency} - {budget.countryCode}
        </p>
    );
}

function BudgetEditForm({
    budget,
    currencies
}: {
    readonly budget: Budget;
    readonly currencies: readonly Currency[];
}) {
    return (
        <form
            action={updateBudgetAction}
            className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
        >
            <input name="budgetId" type="hidden" value={budget.id} />
            <label
                className="grid gap-1 text-sm"
                htmlFor={`budget-${budget.id}-name`}
            >
                <span className="font-medium">Name</span>
                <Input
                    defaultValue={budget.name}
                    id={`budget-${budget.id}-name`}
                    maxLength={120}
                    name="name"
                    required
                />
            </label>
            <CurrencySelect
                currencies={currencies}
                defaultValue={budget.defaultCurrency}
                label="Currency"
            />
            <Button type="submit">Save</Button>
        </form>
    );
}

function ArchiveBudgetForm({ budget }: { readonly budget: Budget }) {
    if (budget.isMain) {
        return null;
    }
    return (
        <form action={archiveBudgetAction}>
            <input name="budgetId" type="hidden" value={budget.id} />
            <Button size="sm" type="submit" variant="outline">
                Archive
            </Button>
        </form>
    );
}

function RestoreBudgetForm({ budget }: { readonly budget: Budget }) {
    return (
        <form action={restoreBudgetAction}>
            <input name="budgetId" type="hidden" value={budget.id} />
            <Button size="sm" type="submit" variant="outline">
                Restore
            </Button>
        </form>
    );
}

function DeleteBudgetForm({ budget }: { readonly budget: Budget }) {
    if (budget.isMain) {
        return null;
    }
    return (
        <form action={deleteBudgetAction}>
            <input name="budgetId" type="hidden" value={budget.id} />
            <Button size="sm" type="submit" variant="destructive">
                Delete
            </Button>
        </form>
    );
}

function MemberList({
    currentUserId,
    members,
    budgetId
}: {
    readonly currentUserId: number;
    readonly members: readonly BudgetMember[];
    readonly budgetId: number;
}) {
    return (
        <div className="space-y-2">
            {members.map(member => (
                <div
                    className="flex flex-col gap-2 rounded-md bg-muted/40 p-2 sm:flex-row sm:items-center sm:justify-between"
                    key={member.userId}
                >
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                            {member.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {roleLabel(member.role)} -{' '}
                            {permissionSummary(member)}
                        </p>
                    </div>
                    {member.userId === currentUserId ? null : (
                        <form action={removeBudgetMemberAction}>
                            <input
                                name="budgetId"
                                type="hidden"
                                value={budgetId}
                            />
                            <input
                                name="userId"
                                type="hidden"
                                value={member.userId}
                            />
                            <Button size="sm" type="submit" variant="outline">
                                Remove
                            </Button>
                        </form>
                    )}
                </div>
            ))}
        </div>
    );
}

function InviteForm({ budget }: { readonly budget: Budget }) {
    if (isMainName(budget.name)) {
        return (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
                Rename this budget before inviting members.
            </div>
        );
    }

    return (
        <form
            action={inviteBudgetMemberAction}
            className="grid gap-3 rounded-md border p-3"
        >
            <input name="budgetId" type="hidden" value={budget.id} />
            <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
                <label
                    className="grid gap-1 text-sm"
                    htmlFor={`budget-${budget.id}-invite-email`}
                >
                    <span className="font-medium">Invite email</span>
                    <Input
                        id={`budget-${budget.id}-invite-email`}
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
            <div className="grid gap-2 sm:grid-cols-2">
                {permissionOptions.map(([key, label, defaultChecked]) => (
                    <label
                        className="flex items-center gap-2 text-sm"
                        key={key}
                    >
                        <input
                            defaultChecked={defaultChecked}
                            name={key}
                            type="checkbox"
                            value="true"
                        />
                        <span>{label}</span>
                    </label>
                ))}
            </div>
        </form>
    );
}

function ActiveBudgetSection({
    budget,
    currencies,
    currentUserId,
    members
}: {
    readonly budget: Budget;
    readonly currencies: readonly Currency[];
    readonly currentUserId: number;
    readonly members: readonly BudgetMember[];
}) {
    const canManage = budget.permissions.canManageMembers;

    return (
        <section className="rounded-md border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <BudgetBadges budget={budget} />
                    <BudgetDetails budget={budget} />
                </div>
                {canManage ? <ArchiveBudgetForm budget={budget} /> : null}
            </div>

            {canManage ? (
                <div className="mt-4 space-y-4">
                    <BudgetEditForm budget={budget} currencies={currencies} />
                    <MemberList
                        budgetId={budget.id}
                        currentUserId={currentUserId}
                        members={members}
                    />
                    <InviteForm budget={budget} />
                </div>
            ) : null}
        </section>
    );
}

function ArchivedBudgetSection({ budget }: { readonly budget: Budget }) {
    return (
        <section className="rounded-md border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <BudgetBadges budget={budget} />
                    <BudgetDetails budget={budget} />
                </div>
                {budget.permissions.canManageMembers ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <RestoreBudgetForm budget={budget} />
                        <DeleteBudgetForm budget={budget} />
                    </div>
                ) : null}
            </div>
        </section>
    );
}

export function BudgetSettings({
    archivedBudgets,
    budgets,
    currencies,
    currentUserId,
    membersByBudget,
    userDefaultCurrency
}: {
    readonly archivedBudgets: readonly Budget[];
    readonly budgets: readonly Budget[];
    readonly currencies: readonly Currency[];
    readonly currentUserId: number;
    readonly membersByBudget: Readonly<Record<number, readonly BudgetMember[]>>;
    readonly userDefaultCurrency: string;
}) {
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
                    className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
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
                    <CurrencySelect
                        currencies={currencies}
                        defaultValue={userDefaultCurrency}
                        label="Currency"
                    />
                    <Button type="submit">Create</Button>
                </form>

                <div className="space-y-3">
                    {budgets.map(budget => (
                        <ActiveBudgetSection
                            budget={budget}
                            currencies={currencies}
                            currentUserId={currentUserId}
                            key={budget.id}
                            members={membersByBudget[budget.id] ?? []}
                        />
                    ))}
                </div>

                {archivedBudgets.length > 0 ? (
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium">
                            Archived budgets
                        </h3>
                        {archivedBudgets.map(budget => (
                            <ArchivedBudgetSection
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
