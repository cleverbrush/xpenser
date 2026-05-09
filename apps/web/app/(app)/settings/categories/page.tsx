import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Field,
    FieldGroup,
    FieldLabel,
    Input,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@xpenser/ui';
import { createCategoryAction, deleteCategoryAction } from '@/lib/actions';
import { getApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
    const client = await getApiClient();
    const categories = await client.categories.list();

    return (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Card>
                <CardHeader>
                    <CardTitle>New category</CardTitle>
                    <CardDescription>
                        Categories are private to your account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={createCategoryAction}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="name">Name</FieldLabel>
                                <Input id="name" name="name" required />
                            </Field>
                            <Field>
                                <FieldLabel>Type</FieldLabel>
                                <Select
                                    defaultValue="expense"
                                    name="type"
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="expense">
                                                Expense
                                            </SelectItem>
                                            <SelectItem value="income">
                                                Income
                                            </SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Button type="submit">Create category</Button>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
            <Card>
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
