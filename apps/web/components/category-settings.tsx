'use client';

import type { Category } from '@xpenser/contracts';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@xpenser/ui';
import { PencilIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import { deleteCategoryAction } from '@/lib/actions';
import {
    categoryEffectiveType,
    categoryTree,
    categoryTypeLabel
} from '@/lib/category-display';
import { directionBadgeClassName } from '@/lib/format';
import { CategoryForm } from './forms/category-form';

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

function CategoryActions({
    categories,
    category,
    deleteDisabled
}: {
    readonly categories: readonly Category[];
    readonly category: Category;
    readonly deleteDisabled: boolean;
}) {
    return (
        <div className="flex shrink-0 gap-1">
            <EditCategoryButton categories={categories} category={category} />
            <form action={deleteCategoryAction}>
                <input name="id" type="hidden" value={category.id} />
                <Button
                    disabled={deleteDisabled}
                    size="sm"
                    type="submit"
                    variant="ghost"
                >
                    Delete
                </Button>
            </form>
        </div>
    );
}

export function CategorySettings({
    categories
}: {
    readonly categories: readonly Category[];
}) {
    const deletingLastCategory = categories.length <= 1;
    const categoryNodes = categoryTree(categories);

    return (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle>New category</CardTitle>
                    <CardDescription>
                        Categories are private to your account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <CategoryForm categories={categories} />
                </CardContent>
            </Card>
            <section className="sm:hidden">
                <h2 className="mb-3 text-base font-semibold">Categories</h2>
                <div className="flex flex-col gap-3">
                    {categories.length === 0 ? (
                        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                            No categories yet.
                        </div>
                    ) : (
                        categoryNodes.map(node => (
                            <Fragment key={node.category.id}>
                                {[node.category, ...node.children].map(
                                    category => {
                                        const isChild =
                                            category.parentId !== null;
                                        const deleteDisabled =
                                            categoryDeleteDisabled(
                                                category,
                                                deletingLastCategory
                                            );

                                        return (
                                            <article
                                                className={`rounded-lg border bg-card p-4 ${
                                                    isChild ? 'ml-5' : ''
                                                }`}
                                                key={category.id}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h3 className="truncate text-sm font-semibold">
                                                            {category.name}
                                                        </h3>
                                                        {isChild ? (
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {
                                                                    category.parentName
                                                                }
                                                            </p>
                                                        ) : null}
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            <CategoryTypeBadge
                                                                category={
                                                                    category
                                                                }
                                                            />
                                                            <Badge variant="outline">
                                                                {categoryStatus(
                                                                    category,
                                                                    deletingLastCategory
                                                                )}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <CategoryActions
                                                        categories={categories}
                                                        category={category}
                                                        deleteDisabled={
                                                            deleteDisabled
                                                        }
                                                    />
                                                </div>
                                            </article>
                                        );
                                    }
                                )}
                            </Fragment>
                        ))
                    )}
                </div>
            </section>
            <Card className="hidden sm:block">
                <CardHeader>
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>
                        Categories in use or with children cannot be deleted.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categoryNodes.map(node => (
                                <Fragment key={node.category.id}>
                                    {[node.category, ...node.children].map(
                                        category => {
                                            const isChild =
                                                category.parentId !== null;
                                            const deleteDisabled =
                                                categoryDeleteDisabled(
                                                    category,
                                                    deletingLastCategory
                                                );

                                            return (
                                                <TableRow key={category.id}>
                                                    <TableCell>
                                                        <span
                                                            className={
                                                                isChild
                                                                    ? 'pl-6'
                                                                    : ''
                                                            }
                                                        >
                                                            {category.name}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <CategoryTypeBadge
                                                            category={category}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {categoryStatus(
                                                                category,
                                                                deletingLastCategory
                                                            )}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <CategoryActions
                                                                categories={
                                                                    categories
                                                                }
                                                                category={
                                                                    category
                                                                }
                                                                deleteDisabled={
                                                                    deleteDisabled
                                                                }
                                                            />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }
                                    )}
                                </Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
