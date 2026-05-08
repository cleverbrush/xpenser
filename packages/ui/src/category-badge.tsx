interface CategoryBadgeProps {
  name: string;
  type: 'expense' | 'income';
}

export function CategoryBadge({ name, type }: CategoryBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        type === 'income'
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
      }`}
    >
      {name}
    </span>
  );
}
