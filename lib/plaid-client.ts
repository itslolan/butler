import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

// Validate environment variables
if (!process.env.PLAID_CLIENT_ID) {
  console.warn('PLAID_CLIENT_ID is not set. Plaid integration will not work.');
}

// Determine which secret to use based on environment
const getPlaidSecret = (): string => {
  const env = process.env.PLAID_ENV || 'sandbox';
  
  switch (env) {
    case 'production':
      return process.env.PLAID_SECRET_PRODUCTION || '';
    case 'development':
      return process.env.PLAID_SECRET_DEVELOPMENT || '';
    case 'sandbox':
    default:
      return process.env.PLAID_SECRET_SANDBOX || '';
  }
};

// Determine Plaid environment
const getPlaidEnvironment = (): string => {
  const env = process.env.PLAID_ENV || 'sandbox';
  
  switch (env) {
    case 'production':
      return PlaidEnvironments.production;
    case 'development':
      return PlaidEnvironments.development;
    case 'sandbox':
    default:
      return PlaidEnvironments.sandbox;
  }
};

// Create Plaid configuration
const configuration = new Configuration({
  basePath: getPlaidEnvironment(),
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
      'PLAID-SECRET': getPlaidSecret(),
    },
  },
});

// Create and export Plaid client
export const plaidClient = new PlaidApi(configuration);

// Export constants for use across the app
export const PLAID_PRODUCTS: Products[] = [Products.Transactions];
export const PLAID_COUNTRY_CODES: CountryCode[] = [CountryCode.Us];
export const PLAID_LANGUAGE = 'en';

// Helper to check if Plaid is configured
export const isPlaidConfigured = (): boolean => {
  return !!(process.env.PLAID_CLIENT_ID && getPlaidSecret());
};

// Plaid category mapping to our categories
export const mapPlaidCategory = (plaidCategories: string[] | null | undefined): string | null => {
  if (!plaidCategories || plaidCategories.length === 0) return null;
  
  const primaryCategory = plaidCategories[0]?.toLowerCase();
  
  // Map Plaid categories to our categories
  const categoryMapping: Record<string, string> = {
    'food and drink': 'Food & Dining',
    'restaurants': 'Food & Dining',
    'groceries': 'Groceries',
    'shops': 'Shopping',
    'shopping': 'Shopping',
    'travel': 'Travel',
    'transportation': 'Transportation',
    'payment': 'Bills & Utilities',
    'transfer': 'Transfer',
    'recreation': 'Entertainment',
    'entertainment': 'Entertainment',
    'healthcare': 'Healthcare',
    'medical': 'Healthcare',
    'service': 'Services',
    'government': 'Government',
    'tax': 'Taxes',
    'bank fees': 'Fees',
    'interest': 'Interest',
    'income': 'Income',
    'payroll': 'Income',
  };
  
  for (const [plaidCat, ourCat] of Object.entries(categoryMapping)) {
    if (primaryCategory.includes(plaidCat)) {
      return ourCat;
    }
  }
  
  return plaidCategories[0] || null;
};

// Determine transaction type from Plaid data
export const determineTransactionType = (
  amount: number,
  categories: string[] | null,
  merchantName: string | null
): 'income' | 'expense' | 'transfer' | 'other' => {
  // Plaid uses positive amounts for money leaving the account
  // and negative amounts for money entering the account
  
  const categoryStr = categories?.join(' ').toLowerCase() || '';
  const merchant = merchantName?.toLowerCase() || '';
  
  // Check for transfers
  if (
    categoryStr.includes('transfer') ||
    categoryStr.includes('bank fees') ||
    merchant.includes('transfer') ||
    merchant.includes('zelle') ||
    merchant.includes('venmo') ||
    merchant.includes('paypal')
  ) {
    return 'transfer';
  }
  
  // Check for income (negative amounts in Plaid = money coming in)
  if (amount < 0) {
    if (
      categoryStr.includes('payroll') ||
      categoryStr.includes('income') ||
      categoryStr.includes('deposit')
    ) {
      return 'income';
    }
    // Could still be income even without category match
    return 'income';
  }
  
  // Positive amounts = money going out = expense
  return 'expense';
};

// Format error messages from Plaid
export const formatPlaidError = (error: any): string => {
  if (error?.response?.data) {
    const plaidError = error.response.data;
    return `${plaidError.error_type}: ${plaidError.error_message}`;
  }
  return error?.message || 'An unknown error occurred with Plaid';
};
