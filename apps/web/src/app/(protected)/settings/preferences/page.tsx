import { getSession } from '../../../../lib/auth';
import { client } from '../../../../lib/api-client';
import { CurrencySelector } from '@xpenser/ui';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NZD'];

export default async function PreferencesPage() {
  const session = await getSession();

  let profile = { email: '', defaultCurrency: 'USD', favoriteCurrencies: ['USD'], authProvider: 'local', createdAt: '' };
  try {
    const result = await client.users.getProfile();
    if (result && typeof result === 'object' && 'email' in result) profile = result as unknown as typeof profile;
  } catch {
    // Not available
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Preferences</h3>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Email</p>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Auth Provider</p>
          <p className="text-sm text-muted-foreground">{profile.authProvider}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Member Since</p>
          <p className="text-sm text-muted-foreground">{profile.createdAt?.slice(0, 10)}</p>
        </div>
      </div>

      <form action={async () => { 'use server'; }} className="rounded-lg border bg-card p-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Default Currency</label>
          <CurrencySelector value={profile.defaultCurrency} onChange={() => {}} currencies={CURRENCIES} />
        </div>
        <div>
          <label className="text-sm font-medium">Favorite Currencies</label>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {CURRENCIES.map((c) => (
              <label key={c} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="favoriteCurrencies" value={c} defaultChecked={profile.favoriteCurrencies.includes(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save</button>
      </form>
    </div>
  );
}
