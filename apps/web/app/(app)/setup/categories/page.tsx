import {
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
    SelectValue
} from '@xpenser/ui';
import { redirect } from 'next/navigation';
import { createFirstCategoryAction } from '@/lib/actions';
import { getApiClient } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function CategorySetupPage() {
    const client = await getApiClient();
    const me = await client.auth.me();
    if (me.hasCategories) {
        redirect('/dashboard');
    }

    return (
        <div className="mx-auto max-w-lg">
            <Card>
                <CardHeader>
                    <CardTitle>Create your first category</CardTitle>
                    <CardDescription>
                        Transactions need a category, so this is required before
                        the dashboard opens.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={createFirstCategoryAction}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="name">Name</FieldLabel>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="Groceries"
                                    required
                                />
                            </Field>
                            <Field>
                                <FieldLabel>Type</FieldLabel>
                                <Select defaultValue="expense" name="type">
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
        </div>
    );
}
