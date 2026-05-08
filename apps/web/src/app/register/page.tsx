import { registerAction } from './actions';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>
          <p className="text-sm text-muted-foreground">Start tracking your expenses</p>
        </div>

        <form action={registerAction} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" name="email" type="email" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input id="password" name="password" type="password" required minLength={8} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Minimum 8 characters" />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Same as above" />
          </div>
          <div className="space-y-2">
            <label htmlFor="defaultCurrency" className="text-sm font-medium">Default Currency</label>
            <select id="defaultCurrency" name="defaultCurrency" defaultValue="USD" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Favorite Currencies</label>
            <div className="grid grid-cols-4 gap-2">
              {CURRENCIES.map((c) => (
                <label key={c} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="favoriteCurrencies" value={c} defaultChecked={c === 'USD'} />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Create Account
          </button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href="/login" className="font-medium text-primary hover:underline">Sign in</a>
        </div>
      </div>
    </div>
  );
}
