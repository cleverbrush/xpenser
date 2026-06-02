'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import { type Category, CreateCategoryBodySchema } from '@xpenser/contracts';
import {
    Badge,
    Button,
    cn,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    FieldError
} from '@xpenser/ui';
import {
    ArchiveIcon,
    ArchiveRestoreIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    PencilIcon,
    PlusIcon,
    Trash2Icon,
    XIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import {
    createCategoryAction,
    deleteCategoryAction,
    setCategoryArchivedAction
} from '@/lib/actions';
import {
    type CategoryTreeNode,
    categoryArchived,
    categoryAvailableForTransactions,
    categoryEffectiveType,
    categoryTree,
    categoryTypeLabel
} from '@/lib/category-display';
import { directionBadgeClassName } from '@/lib/format';
import { CategoryForm } from './forms/category-form';
import { isNextRedirectError, valuesToFormData } from './forms/form-utils';
import { SchemaCheckboxField } from './forms/schema-fields';

type CategoryType = Category['type'];

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
            <DialogContent
                onOpenAutoFocus={event => {
                    event.preventDefault();
                }}
            >
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
    expanded,
    nested = false,
    onToggle
}: {
    readonly categories: readonly Category[];
    readonly category: Category;
    readonly deletingLastCategory: boolean;
    readonly expanded?: boolean;
    readonly nested?: boolean;
    readonly onToggle?: () => void;
}) {
    const deleteDisabled = categoryDeleteDisabled(
        category,
        deletingLastCategory
    );
    const archived = categoryArchived(category);
    const available = categoryAvailableForTransactions(category, categories);

    const collapsible = category.parentId === null;
    const ToggleIcon = expanded ? ChevronDownIcon : ChevronRightIcon;

    return (
        <div
            className={cn(
                'flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between',
                nested && 'pl-8 sm:pl-10',
                !available && 'bg-muted/30 text-muted-foreground'
            )}
        >
            <div className="flex min-w-0 gap-2">
                {collapsible ? (
                    <Button
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${
                            category.displayName
                        }`}
                        className="mt-0.5 shrink-0"
                        onClick={onToggle}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                    >
                        <ToggleIcon aria-hidden className="size-4" />
                    </Button>
                ) : null}
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
                        <Badge variant="outline">
                            {childKindLabel(category)}
                        </Badge>
                        <Badge variant="outline">
                            {categoryStatus(category, deletingLastCategory)}
                        </Badge>
                    </div>
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
    onCancel,
    parent,
    type
}: {
    readonly onCancel: () => void;
    readonly parent?: Category;
    readonly type: CategoryType;
}) {
    const form = useSchemaForm(CreateCategoryBodySchema);
    const router = useRouter();
    const [reverseDirection, setReverseDirection] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formVersion, setFormVersion] = useState(0);
    const isChild = Boolean(parent);
    const typeLabel = categoryTypeLabel(type).toLowerCase();

    useEffect(() => {
        form.reset({
            type,
            parentId: parent?.id ?? null,
            kind: 'normal'
        });
        setReverseDirection(false);
        setFormVersion(version => version + 1);
    }, [form, parent?.id, type]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        form.setValue({
            type,
            parentId: parent?.id ?? null,
            kind: isChild && reverseDirection ? 'offset' : 'normal'
        });
        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        setPending(true);
        setError(null);
        try {
            await createCategoryAction(valuesToFormData(result.object));
            form.reset({
                type,
                parentId: parent?.id ?? null,
                kind: 'normal'
            });
            setReverseDirection(false);
            setFormVersion(version => version + 1);
            onCancel();
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
                    ? 'grid-cols-1 bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,auto)_auto_auto]'
                    : 'grid-cols-1 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]'
            )}
            data-testid={isChild ? 'subcategory-form' : `${type}-category-form`}
            key={formVersion}
            noValidate
            onSubmit={handleSubmit}
        >
            <SchemaField
                fieldProps={{
                    'aria-label': parent
                        ? `New ${parent.name} subcategory name`
                        : `New ${categoryTypeLabel(type)} category name`,
                    disabled: pending,
                    placeholder: parent
                        ? `New ${parent.name} subcategory`
                        : `New ${typeLabel} category`
                }}
                forProperty={field => field.name}
                form={form}
                name="name"
            />
            {parent ? (
                <SchemaCheckboxField
                    checked={reverseDirection}
                    description={`Report as ${offsetKindLabel(
                        type
                    ).toLowerCase()}.`}
                    disabled={pending}
                    forProperty={field => field.kind}
                    form={form}
                    label="Reverse direction"
                    onChange={(checked, field) => {
                        field.onChange(checked ? 'offset' : 'normal');
                        setReverseDirection(checked);
                    }}
                />
            ) : null}
            <Button disabled={pending} size="sm" type="submit">
                <PlusIcon aria-hidden className="size-4" />
                {pending
                    ? 'Adding...'
                    : parent
                      ? 'Add subcategory'
                      : `Add ${typeLabel}`}
            </Button>
            <Button
                aria-label="Cancel adding category"
                disabled={pending}
                onClick={onCancel}
                size="icon-sm"
                type="button"
                variant="ghost"
            >
                <XIcon aria-hidden className="size-4" />
            </Button>
            {error ? (
                <FieldError className="sm:col-span-full" role="alert">
                    {error}
                </FieldError>
            ) : null}
        </form>
    );
}

function AddCategoryButton({
    label,
    onClick
}: {
    readonly label: string;
    readonly onClick: () => void;
}) {
    return (
        <Button
            aria-label={label}
            className="px-2 sm:px-3"
            onClick={onClick}
            size="sm"
            type="button"
            variant="ghost"
        >
            <PlusIcon aria-hidden className="size-4" />
            <span className="hidden sm:inline">{label}</span>
        </Button>
    );
}

function CategoryNode({
    categories,
    deletingLastCategory,
    node,
    type
}: {
    readonly categories: readonly Category[];
    readonly deletingLastCategory: boolean;
    readonly node: CategoryTreeNode<Category>;
    readonly type: CategoryType;
}) {
    const [expanded, setExpanded] = useState(false);
    const [addingChild, setAddingChild] = useState(false);
    const archived = categoryArchived(node.category);

    return (
        <div className="flex flex-col divide-y">
            <CategoryRow
                categories={categories}
                category={node.category}
                deletingLastCategory={deletingLastCategory}
                expanded={expanded}
                onToggle={() => {
                    setExpanded(current => !current);
                    setAddingChild(false);
                }}
            />
            {expanded ? (
                <>
                    {node.children.map(child => (
                        <CategoryRow
                            categories={categories}
                            category={child}
                            deletingLastCategory={deletingLastCategory}
                            key={child.id}
                            nested
                        />
                    ))}
                    {archived ? null : (
                        <div className="bg-muted/20">
                            {addingChild ? (
                                <QuickCategoryForm
                                    onCancel={() => setAddingChild(false)}
                                    parent={node.category}
                                    type={type}
                                />
                            ) : (
                                <div className="p-2 pl-8 sm:pl-10">
                                    <AddCategoryButton
                                        label={`Add subcategory to ${node.category.name}`}
                                        onClick={() => setAddingChild(true)}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : null}
        </div>
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
    const [addingParent, setAddingParent] = useState(false);

    return (
        <section className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-3 border-b p-4">
                <div>
                    <h2 className="text-base font-semibold">{title}</h2>
                    <p className="text-sm text-muted-foreground">
                        Add parent categories and the subcategories used for
                        transactions.
                    </p>
                </div>
                <AddCategoryButton
                    label={`Add ${categoryTypeLabel(type).toLowerCase()}`}
                    onClick={() => setAddingParent(true)}
                />
            </div>
            {addingParent ? (
                <div className="border-b">
                    <QuickCategoryForm
                        onCancel={() => setAddingParent(false)}
                        type={type}
                    />
                </div>
            ) : null}
            <div className="flex flex-col divide-y">
                {nodes.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                        No {type} categories yet.
                    </div>
                ) : (
                    nodes.map(node => (
                        <CategoryNode
                            categories={categories}
                            deletingLastCategory={deletingLastCategory}
                            key={node.category.id}
                            node={node}
                            type={type}
                        />
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
