'use client';

const PERIODS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
] as const;

interface PeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="inline-flex rounded-md border border-input">
      {PERIODS.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={`px-4 py-2 text-sm font-medium ${
            value === period.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-accent'
          } first:rounded-l-md last:rounded-r-md`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
