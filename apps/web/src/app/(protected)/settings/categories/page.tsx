import { getSession } from '../../../../lib/auth';
import { client } from '../../../../lib/api-client';
import { CategoryBadge } from '@xpenser/ui';

export default async function CategoriesPage() {
  const session = await getSession();

  let categories: Record<string, unknown>[] = [];
  try {
    const cats = await client.categories.list();
    if (Array.isArray(cats)) categories = cats as unknown as typeof categories;
  } catch {
    // Not available
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Categories</h3>
        <form action={async () => { 'use server'; }} className="flex gap-2">
          <input name="name" required placeholder="Category name" className="rounded-md border px-3 py-1 text-sm" maxLength={100} />
          <select name="type" className="rounded-md border px-2 py-1 text-sm">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <button type="submit" className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">Add</button>
        </form>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">No categories yet. Create your first category to start tracking expenses!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id as number} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{cat.name as string}</span>
                <CategoryBadge name={cat.name as string} type={cat.type as 'expense' | 'income'} />
              </div>
              <button className="text-xs text-destructive hover:underline">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
