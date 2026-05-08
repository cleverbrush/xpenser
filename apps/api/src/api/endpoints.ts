import { api } from '@xpenser/contract/api';
import { DbToken, TrackedDbToken } from '../di/tokens.js';

export const RegisterEndpoint = api.auth.register
  .inject({ db: DbToken })
  .summary('Register a new user')
  .description('Creates a new user account with email/password registration.')
  .tags('auth')
  .operationId('register');

export const LoginEndpoint = api.auth.login
  .inject({ db: DbToken })
  .summary('Login')
  .description('Authenticates a user with email and password, returning a signed JWT.')
  .tags('auth')
  .operationId('login');

export const GoogleLoginEndpoint = api.auth.googleLogin
  .inject({ db: DbToken })
  .summary('Login with Google')
  .description('Exchanges a Google ID token for an application JWT. Auto-provisions user on first login.')
  .tags('auth')
  .operationId('googleLogin');

export const GetProfileEndpoint = api.users.getProfile
  .authorize('user')
  .inject({ db: DbToken })
  .summary('Get current user profile')
  .description('Returns the authenticated user profile.')
  .tags('users')
  .operationId('getProfile');

export const UpdateProfileEndpoint = api.users.updateProfile
  .authorize('user')
  .inject({ db: TrackedDbToken })
  .summary('Update user profile')
  .description('Updates default currency and favorite currencies for the authenticated user.')
  .tags('users')
  .operationId('updateProfile');

export const ListCategoriesEndpoint = api.categories.list
  .authorize('user')
  .inject({ db: DbToken })
  .summary('List categories')
  .description('Returns all categories for the authenticated user.')
  .tags('categories')
  .operationId('listCategories');

export const CreateCategoryEndpoint = api.categories.create
  .authorize('user')
  .inject({ db: TrackedDbToken })
  .summary('Create category')
  .description('Creates a new expense or income category.')
  .tags('categories')
  .operationId('createCategory');

export const UpdateCategoryEndpoint = api.categories.update
  .authorize('user')
  .inject({ db: TrackedDbToken })
  .summary('Update category')
  .description('Updates name or type of an existing category. Verifies ownership.')
  .tags('categories')
  .operationId('updateCategory');

export const DeleteCategoryEndpoint = api.categories.delete
  .authorize('user')
  .inject({ db: TrackedDbToken })
  .summary('Delete category')
  .description('Deletes a category. Fails with 409 if the category has associated transactions.')
  .tags('categories')
  .operationId('deleteCategory');

export const ListTransactionsEndpoint = api.transactions.list
  .authorize('user')
  .inject({ db: DbToken })
  .summary('List transactions')
  .description('Returns paginated, filterable list of transactions for the authenticated user.')
  .tags('transactions')
  .operationId('listTransactions');

export const GetTransactionEndpoint = api.transactions.get
  .authorize('user')
  .inject({ db: DbToken })
  .summary('Get transaction')
  .description('Returns a single transaction by ID. Verifies ownership.')
  .tags('transactions')
  .operationId('getTransaction');

export const CreateTransactionEndpoint = api.transactions.create
  .authorize('user')
  .inject({ db: TrackedDbToken })
  .summary('Create transaction')
  .description('Creates a new income or expense transaction.')
  .tags('transactions')
  .operationId('createTransaction');

export const UpdateTransactionEndpoint = api.transactions.update
  .authorize('user')
  .inject({ db: TrackedDbToken })
  .summary('Update transaction')
  .description('Updates an existing transaction. Verifies ownership.')
  .tags('transactions')
  .operationId('updateTransaction');

export const DeleteTransactionEndpoint = api.transactions.delete
  .authorize('user')
  .inject({ db: TrackedDbToken })
  .summary('Delete transaction')
  .description('Deletes a transaction. Verifies ownership.')
  .tags('transactions')
  .operationId('deleteTransaction');

export const GetDashboardSummaryEndpoint = api.dashboard.getSummary
  .authorize('user')
  .inject({ db: DbToken })
  .summary('Dashboard summary')
  .description('Returns aggregated expense/income data for the selected period.')
  .tags('dashboard')
  .operationId('getDashboardSummary');

export const ListCurrenciesEndpoint = api.currencies.list
  .summary('List available currencies')
  .description('Returns list of available currency codes.')
  .tags('currencies')
  .operationId('listCurrencies');

export const ConvertCurrencyEndpoint = api.currencies.convert
  .inject({ db: DbToken })
  .summary('Convert currency')
  .description('Converts an amount between two currencies using stored exchange rates.')
  .tags('currencies')
  .operationId('convertCurrency');
