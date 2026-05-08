import Link from 'next/link';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>
      <div className="flex gap-4 border-b">
        <Link href="/settings/categories" className="px-4 py-2 text-sm font-medium hover:border-b-2 hover:border-primary">Categories</Link>
        <Link href="/settings/preferences" className="px-4 py-2 text-sm font-medium hover:border-b-2 hover:border-primary">Preferences</Link>
      </div>
      {children}
    </div>
  );
}
