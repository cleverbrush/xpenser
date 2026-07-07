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
    createBudgetAction,
    inviteBudgetMemberAction,
    removeBudgetMemberAction
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

export function BudgetSettings({
    budgets,
    currencies,
    currentUserId,
    membersByBudget,
    userCountryCode,
    userDefaultCurrency
}: {
    readonly budgets: readonly Budget[];
    readonly currencies: readonly Currency[];
    readonly currentUserId: number;
    readonly membersByBudget: Readonly<Record<number, readonly BudgetMember[]>>;
    readonly userCountryCode: string;
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
                    className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_9rem_7rem_auto] sm:items-end"
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
                    <label className="grid gap-1 text-sm">
                        <span className="font-medium">Currency</span>
                        <select
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                            defaultValue={userDefaultCurrency}
                            name="defaultCurrency"
                        >
                            {currencies.map(currency => (
                                <option
                                    key={currency.code}
                                    value={currency.code}
                                >
                                    {currency.code}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label
                        className="grid gap-1 text-sm"
                        htmlFor="new-budget-country"
                    >
                        <span className="font-medium">Country</span>
                        <Input
                            defaultValue={userCountryCode}
                            id="new-budget-country"
                            maxLength={2}
                            name="countryCode"
                            required
                        />
                    </label>
                    <Button type="submit">Create</Button>
                </form>

                <div className="space-y-3">
                    {budgets.map(budget => {
                        const members = membersByBudget[budget.id] ?? [];
                        const canManage = budget.permissions.canManageMembers;
                        return (
                            <section
                                className="rounded-md border p-3"
                                key={budget.id}
                            >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-medium">
                                                {budget.name}
                                            </h3>
                                            <Badge variant="outline">
                                                {roleLabel(budget.role)}
                                            </Badge>
                                            {budget.isMain ? (
                                                <Badge>Main</Badge>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {budget.defaultCurrency} -{' '}
                                            {budget.countryCode}
                                        </p>
                                    </div>
                                </div>

                                {canManage ? (
                                    <div className="mt-4 space-y-4">
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
                                                            {roleLabel(
                                                                member.role
                                                            )}{' '}
                                                            -{' '}
                                                            {permissionSummary(
                                                                member
                                                            )}
                                                        </p>
                                                    </div>
                                                    {member.userId ===
                                                    currentUserId ? null : (
                                                        <form
                                                            action={
                                                                removeBudgetMemberAction
                                                            }
                                                        >
                                                            <input
                                                                name="budgetId"
                                                                type="hidden"
                                                                value={
                                                                    budget.id
                                                                }
                                                            />
                                                            <input
                                                                name="userId"
                                                                type="hidden"
                                                                value={
                                                                    member.userId
                                                                }
                                                            />
                                                            <Button
                                                                size="sm"
                                                                type="submit"
                                                                variant="outline"
                                                            >
                                                                Remove
                                                            </Button>
                                                        </form>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <form
                                            action={inviteBudgetMemberAction}
                                            className="grid gap-3 rounded-md border p-3"
                                        >
                                            <input
                                                name="budgetId"
                                                type="hidden"
                                                value={budget.id}
                                            />
                                            <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
                                                <label
                                                    className="grid gap-1 text-sm"
                                                    htmlFor={`budget-${budget.id}-invite-email`}
                                                >
                                                    <span className="font-medium">
                                                        Invite email
                                                    </span>
                                                    <Input
                                                        id={`budget-${budget.id}-invite-email`}
                                                        name="email"
                                                        placeholder="teammate@example.com"
                                                        required
                                                        type="email"
                                                    />
                                                </label>
                                                <label className="grid gap-1 text-sm">
                                                    <span className="font-medium">
                                                        Role
                                                    </span>
                                                    <select
                                                        className="h-10 rounded-md border bg-background px-3 text-sm"
                                                        defaultValue="member"
                                                        name="role"
                                                    >
                                                        <option value="member">
                                                            Member
                                                        </option>
                                                        <option value="admin">
                                                            Admin
                                                        </option>
                                                    </select>
                                                </label>
                                                <Button type="submit">
                                                    Invite
                                                </Button>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {permissionOptions.map(
                                                    ([
                                                        key,
                                                        label,
                                                        defaultChecked
                                                    ]) => (
                                                        <label
                                                            className="flex items-center gap-2 text-sm"
                                                            key={key}
                                                        >
                                                            <input
                                                                defaultChecked={
                                                                    defaultChecked
                                                                }
                                                                name={key}
                                                                type="checkbox"
                                                                value="true"
                                                            />
                                                            <span>{label}</span>
                                                        </label>
                                                    )
                                                )}
                                            </div>
                                        </form>
                                    </div>
                                ) : null}
                            </section>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
