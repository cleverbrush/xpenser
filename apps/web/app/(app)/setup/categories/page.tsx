import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import { redirect } from 'next/navigation';
import { CategorySetupForm } from '@/components/forms/category-setup-form';
import { getCurrentUser } from '@/lib/api';

export default async function CategorySetupPage() {
    const me = await getCurrentUser();
    if (me.hasCategories) {
        redirect('/dashboard');
    }

    return (
        <div className="mx-auto max-w-lg">
            <Card>
                <CardHeader>
                    <CardTitle>Create your first categories</CardTitle>
                    <CardDescription>
                        Transactions need a category, so this is required before
                        the dashboard opens.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CategorySetupForm />
                </CardContent>
            </Card>
        </div>
    );
}
