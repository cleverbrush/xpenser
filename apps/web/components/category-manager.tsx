'use client';

import type { Category } from '@xpenser/contracts';
import {
    Badge,
    Button,
    cn,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    FieldError,
    Input
} from '@xpenser/ui';
import {
    ArchiveIcon,
    ArchiveRestoreIcon,
    PencilIcon,
    PlusIcon,
    Trash2Icon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, Fragment, useState } from 'react';
import {
    createCategoryAction,
    deleteCategoryAction,
    setCategoryArchivedAction
} from '@/lib/actions';
import {
    categoryArchived,
    categoryAvailableForTransactions,
    categoryEffectiveType,
    categoryTree,
    categoryTypeLabel
} from '@/lib/category-display';
import { directionBadgeClassName } from '@/lib/format';
import { CategoryForm } from './forms/category-form';
import { isNextRedirectError } from './forms/form-utils';

type CategoryType = Category['type'];
type CategoryKind = Category['kind'];

function offsetKindLabel(type: CategoryType): string {
    return type === 'expense' ? 'Return' : 'Expense';
}

function childKindLabel(category: Category): string {
    if (category.parentId === null) {
        return 'Parent';
    }
    return category.kind === 'offset'
        ? offsetKindLabel(category.type)
        : 'Same direction';
}

function categoryDeleteDisabled(
    category: Category,
    deletingLastCategory: boolean
): boolean {
    return category.inUse || category.hasChildren || deletingLastCategory;
}

function categoryStatus(category: Category, deletingLastCategory: boolean) {
    if (deletingLastCategory) {
        return 'Required';
    }
    if (category.hasChildren) {
        return 'Has children';
    }
    return category.inUse ? 'In use' : 'Unused';
}

function CategoryTypeBadge({ category }: { readonly category: Category }) {
    const effectiveType = categoryEffectiveType(category);

    return (
        <Badge
            className={directionBadgeClassName(effectiveType)}
            variant="outline"
        >
            {categoryTypeLabel(effectiveType)}
        </Badge>
    );
}

function EditCategoryButton({
    categories,
    category
}: {
    readonly categories: readonly Category[];
    readonly category: Category;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog onOpenChange={setOpen} open={open}>
            <DialogTrigger asChild>
                <Button
                    aria-label={`Edit ${category.displayName}`}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <PencilIcon aria-hidden className="size-4" />
                    Edit
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit category</DialogTitle>
                </DialogHeader>
                <CategoryForm
                    categories={categories}
                    initialCategory={category}
                    onSaved={() => setOpen(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

function ArchiveCategoryButton({ category }: { readonly category: Category }) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const archived = categoryArchived(category);
    const Icon = archived ? ArchiveRestoreIcon : ArchiveIcon;

    async function handleClick() {
        const formData = new FormData();
        formData.set('id', String(category.id));
        formData.set('archived', String(!archived));

        setPending(true);
        try {
            await setCategoryArchivedAction(formData);
            router.refresh();
        } finally {
            setPending(false);
        }
    }

    return (
        <Button
            aria-label={`${archived ? 'Restore' : 'Archive'} ${
                category.displayName
            }`}
            disabled={pending}
            onClick={() => {
                void handleClick();
            }}
            size="sm"
            type="button"
            variant="ghost"
        >
            <Icon aria-hidden className="size-4" />
            {pending ? 'Saving...' : archived ? 'Restore' : 'Archive'}
        </Button>
    );
}

function DeleteCategoryButton({
    category,
    disabled
}: {
    readonly category: Category;
    readonly disabled: boolean;
}) {
    return (
        <form action={deleteCategoryAction}>
            <input name="id" type="hidden" value={category.id} />
            <Button disabled={disabled} size="sm" type="submit" variant="ghost">
                <Trash2Icon aria-hidden className="size-4" />
                Delete
            </Button>
        </form>
    );
}

function CategoryRow({
    categories,
    category,
    deletingLastCategory,
    nested = false
}: {
    readonly categories: readonly Category[];
    readonly category: Category;
    readonly deletingLastCategory: boolean;
    readonly nested?: boolean;
}) {
    const deleteDisabled = categoryDeleteDisabled(
        category,
        deletingLastCategory
    );
    const archived = categoryArchived(category);
    const available = categoryAvailableForTransactions(category, categories);

    return (
        <div
            className={cn(
                'flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between',
                nested && 'pl-8 sm:pl-10',
                !available && 'bg-muted/30 text-muted-foreground'
            )}
        >
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                        {category.name}
                    </p>
                    {archived ? (
                        <Badge variant="outline">Archived</Badge>
                    ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                    <CategoryTypeBadge category={category} />
                    <Badge variant="outline">{childKindLabel(category)}</Badge>
                    <Badge variant="outline">
                        {categoryStatus(category, deletingLastCategory)}
                    </Badge>
                </div>
            </div>
            <div className="flex flex-wrap gap-1 sm:justify-end">
                <EditCategoryButton
                    categories={categories}
                    category={category}
                />
                <ArchiveCategoryButton category={category} />
                <DeleteCategoryButton
                    category={category}
                    disabled={deleteDisabled}
                />
            </div>
        </div>
    );
}

function QuickCategoryForm({
    parent,
    type
}: {
    readonly parent?: Category;
    readonly type: CategoryType;
}) {
    const router = useRouter();
    const [name, setName] = useState('');
    const [kind, setKind] = useState<CategoryKind>('normal');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isChild = Boolean(parent);
    const typeLabel = categoryTypeLabel(type).toLowerCase();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmedName = name.trim();
        if (trimmedName.length === 0) {
            setError('Enter a category name.');
            return;
        }

        const formData = new FormData();
        formData.set('name', trimmedName);
        formData.set('type', type);
        formData.set('kind', isChild ? kind : 'normal');
        if (parent) {
            formData.set('parentId', String(parent.id));
        }

        setPending(true);
        setError(null);
        try {
            await createCategoryAction(formData);
            setName('');
            setKind('normal');
            router.refresh();
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError('Could not create the category.');
        } finally {
            setPending(false);
        }
    }

    return (
        <form
            className={cn(
                'grid gap-2',
                isChild
                    ? 'grid-cols-1 border-t bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_9.5rem_auto]'
                    : 'grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]'
            )}
            data-testid={isChild ? 'subcategory-form' : `${type}-category-form`}
            noValidate
            onSubmit={handleSubmit}
        >
            <Input
                aria-label={
                    parent
                        ? `New ${parent.name} subcategory name`
                        : `New ${categoryTypeLabel(type)} category name`
                }
                disabled={pending}
                onChange={event => setName(event.target.value)}
                placeholder={
                    parent
                        ? `New ${parent.name} subcategory`
                        : `New ${typeLabel} category`
                }
                value={name}
            />
            {parent ? (
                <select
                    aria-label={`${parent.name} subcategory behavior`}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={pending}
                    onChange={event =>
                        setKind(
                            event.target.value === 'offset'
                                ? 'offset'
                                : 'normal'
                        )
                    }
                    value={kind}
                >
                    <option value="normal">Same direction</option>
                    <option value="offset">{offsetKindLabel(type)}</option>
                </select>
            ) : null}
            <Button disabled={pending} type="submit">
                <PlusIcon aria-hidden className="size-4" />
                {pending
                    ? 'Adding...'
                    : parent
                      ? 'Add subcategory'
                      : `Add ${typeLabel}`}
            </Button>
            {error ? (
                <FieldError className="sm:col-span-full" role="alert">
                    {error}
                </FieldError>
            ) : null}
        </form>
    );
}

function CategorySection({
    categories,
    type
}: {
    readonly categories: readonly Category[];
    readonly type: CategoryType;
}) {
    const sectionCategories = categories.filter(
        category => category.type === type
    );
    const nodes = categoryTree(sectionCategories);
    const deletingLastCategory = categories.length <= 1;
    const title = `${categoryTypeLabel(type)} categories`;

    return (
        <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b p-4">
                <h2 className="text-base font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">
                    Add parent categories and the subcategories used for
                    transactions.
                </p>
            </div>
            <div className="border-b p-3">
                <QuickCategoryForm type={type} />
            </div>
            <div className="flex flex-col divide-y">
                {nodes.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                        No {type} categories yet.
                    </div>
                ) : (
                    nodes.map(node => (
                        <Fragment key={node.category.id}>
                            <CategoryRow
                                categories={categories}
                                category={node.category}
                                deletingLastCategory={deletingLastCategory}
                            />
                            {node.children.map(child => (
                                <CategoryRow
                                    categories={categories}
                                    category={child}
                                    deletingLastCategory={deletingLastCategory}
                                    key={child.id}
                                    nested
                                />
                            ))}
                            {categoryArchived(node.category) ? null : (
                                <QuickCategoryForm
                                    parent={node.category}
                                    type={type}
                                />
                            )}
                        </Fragment>
                    ))
                )}
            </div>
        </section>
    );
}

export function CategoryManager({
    categories
}: {
    readonly categories: readonly Category[];
}) {
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <CategorySection categories={categories} type="expense" />
            <CategorySection categories={categories} type="income" />
        </div>
    );
}
