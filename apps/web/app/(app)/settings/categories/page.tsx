import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@xpenser/ui';
import { CategoryForm } from '@/components/forms/category-form';
import { deleteCategoryAction } from '@/lib/actions';
import { getApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
    const client = await getApiClient();
    const categories = await client.categories.list();

    return (
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[360px_1fr]">
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle>New category</CardTitle>
                    <CardDescription>
                        Categories are private to your account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <CategoryForm />
                </CardContent>
            </Card>
            <section className="sm:hidden">
                <h1 className="mb-3 text-base font-semibold">Categories</h1>
                <div className="flex flex-col gap-3">
                    {categories.length === 0 ? (
                        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                            No categories yet.
                        </div>
                    ) : (
                        categories.map(category => (
                            <article
                                className="rounded-lg border bg-card p-4"
                                key={category.id}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h2 className="truncate text-sm font-semibold">
                                            {category.name}
                                        </h2>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <Badge variant="secondary">
                                                {category.type}
                                            </Badge>
                                            <Badge variant="outline">
                                                {category.inUse
                                                    ? 'In use'
                                                    : 'Unused'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <form
                                        action={deleteCategoryAction}
                                        className="shrink-0"
                                    >
                                        <input
                                            name="id"
                                            type="hidden"
                                            value={category.id}
                                        />
                                        <Button
                                            disabled={category.inUse}
                                            size="sm"
                                            type="submit"
                                            variant="ghost"
                                        >
                                            Delete
                                        </Button>
                                    </form>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            </section>
            <Card className="hidden sm:block">
                <CardHeader>
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>
                        Categories in use cannot be deleted.
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
                            {categories.map(category => (
                                <TableRow key={category.id}>
                                    <TableCell>{category.name}</TableCell>
                                    <TableCell>{category.type}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {category.inUse
                                                ? 'In use'
                                                : 'Unused'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <form action={deleteCategoryAction}>
                                            <input
                                                name="id"
                                                type="hidden"
                                                value={category.id}
                                            />
                                            <Button
                                                disabled={category.inUse}
                                                size="sm"
                                                type="submit"
                                                variant="ghost"
                                            >
                                                Delete
                                            </Button>
                                        </form>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
