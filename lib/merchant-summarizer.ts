// Minimal transaction type for summarization
export interface TransactionForSummary {
  merchant: string;
  amount: number;
  date: string | Date;
  description?: string | null;
}

export interface MerchantSummary {
  merchant_key: string;
  original_name: string;
  sample_transactions: Array<{
    date: string;
    amount: number;
    description: string;
  }>;
  stats: {
    count: number;
    median_interval_days: number;
    interval_cv: number; // coefficient of variation
    day_concentration: string; // e.g., "8/10 within ±3 days of day 15"
    amount_mean: number;
    amount_rstd: number; // relative std dev
    flags: string[]; // ["contains_bill", "ach", "autopay"]
  };
  first_date: string;
  last_date: string;
  unique_months: number;
}

/**
 * Convert date to YYYY-MM-DD string format
 */
function dateToString(date: string | Date): string {
  if (typeof date === 'string') return date.split('T')[0];
  return date.toISOString().split('T')[0];
}

/**
 * Normalize merchant names for grouping
 * Strips common variations like store numbers, locations, etc.
 * Also normalizes common categories (rent, utilities, etc.) to a standard name
 */
function normalizeMerchantName(merchant: string): string {
  let normalized = merchant
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*#\d+/g, '') // Remove store numbers like #1234
    .replace(/\s*\d{4,}/g, '') // Remove long numbers (phone numbers, etc.)
    .replace(/\s+-\s+.*/g, '') // Remove location suffixes
    .replace(/\s+/g, ' ')
    .trim();
  
  // Normalize rent-related merchants to a common key
  // This helps group different rent payment names together
  if (/\b(rent|lease|rental|landlord|property\s*management|realty|housing)\b/i.test(normalized)) {
    // Check if it contains specific company names that should be preserved
    const hasCompanyName = /\b(wells\s*fargo|bank\s*of\s*america|chase|citi|apartment|complex)\b/i.test(normalized);
    if (!hasCompanyName) {
      return 'rent payment'; // Standardized key for generic rent payments
    }
  }
  
  return normalized;
}

/**
 * Calculate median value from an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate coefficient of variation (std dev / mean)
 */
function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 1; // High CV if mean is 0
  
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev / mean;
}

/**
 * Calculate day-of-month concentration
 * Returns string like "8/10 within ±3 days of day 15"
 */
function calculateDayConcentration(daysOfMonth: number[]): string {
  if (daysOfMonth.length < 3) return 'insufficient data';
  
  const avgDay = Math.round(daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length);
  
  // Count how many are within ±3 days of average
  const withinThree = daysOfMonth.filter(d => Math.abs(d - avgDay) <= 3).length;
  
  return `${withinThree}/${daysOfMonth.length} within ±3 days of day ${avgDay}`;
}

/**
 * Extract flags from merchant name and descriptions
 */
function extractFlags(merchantName: string, descriptions: string[]): string[] {
  const flags: string[] = [];
  const lowerMerchant = merchantName.toLowerCase();
  const allText = [lowerMerchant, ...descriptions.map(d => d.toLowerCase())].join(' ');
  
  // Bill/payment keywords
  if (/\b(bill|payment|pay|autopay|auto-pay)\b/.test(allText)) {
    flags.push('contains_bill_keyword');
  }
  
  // Utility keywords
  if (/\b(electric|gas|water|utility|utilities|power|energy)\b/.test(allText)) {
    flags.push('utility');
  }
  
  // Loan/mortgage keywords
  if (/\b(loan|mortgage|servicing|lending)\b/.test(allText)) {
    flags.push('loan_mortgage');
  }
  
  // Insurance keywords
  if (/\b(insurance|ins\b|policy)\b/.test(allText)) {
    flags.push('insurance');
  }
  
  // Subscription keywords
  if (/\b(subscription|monthly|annual|membership)\b/.test(allText)) {
    flags.push('subscription');
  }
  
  // ACH/autopay indicators
  if (/\b(ach|direct debit|recurring|automatic)\b/.test(allText)) {
    flags.push('ach_autopay');
  }
  
  // Account/account number indicators
  if (/\b(acct|account|a\/c)\b/.test(allText)) {
    flags.push('has_account_number');
  }
  
  return flags;
}

/**
 * Pick representative sample transactions
 * Returns first, middle, and last transaction
 */
function pickSampleTransactions(
  transactions: Array<{date: string; amount: number; description: string}>
): Array<{date: string; amount: number; description: string}> {
  if (transactions.length <= 3) return transactions;
  
  const first = transactions[0];
  const middle = transactions[Math.floor(transactions.length / 2)];
  const last = transactions[transactions.length - 1];
  
  return [first, middle, last];
}

/**
 * Create merchant summaries from raw transactions
 */
export function createMerchantSummaries(transactions: TransactionForSummary[]): MerchantSummary[] {
  // Group transactions by normalized merchant name
  const merchantGroups = new Map<string, TransactionForSummary[]>();
  
  for (const txn of transactions) {
    const normalizedName = normalizeMerchantName(txn.merchant);
    
    if (!merchantGroups.has(normalizedName)) {
      merchantGroups.set(normalizedName, []);
    }
    
    merchantGroups.get(normalizedName)!.push(txn);
  }
  
  const summaries: MerchantSummary[] = [];
  
  // Create summary for each merchant group
  for (const [merchantKey, txns] of merchantGroups) {
    // Sort by date
    const sortedTxns = [...txns].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Need at least 3 transactions
    if (sortedTxns.length < 3) {
      continue;
    }
    
    // Calculate unique months using UTC to avoid timezone issues
    const uniqueMonths = new Set(sortedTxns.map(t => {
      const d = new Date(t.date);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }));
    
    // Need at least 3 unique months
    if (uniqueMonths.size < 3) {
      continue;
    }
    
    // Calculate intervals between transactions (in days)
    const intervals: number[] = [];
    for (let i = 1; i < sortedTxns.length; i++) {
      const days = (new Date(sortedTxns[i].date).getTime() - new Date(sortedTxns[i-1].date).getTime()) 
        / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }
    
    // Extract data for stats (use UTC to avoid timezone issues)
    const amounts = sortedTxns.map(t => Math.abs(Number(t.amount)));
    const daysOfMonth = sortedTxns.map(t => new Date(t.date).getUTCDate());
    const descriptions = sortedTxns.map(t => t.description || t.merchant);
    
    // Calculate stats
    const medianInterval = median(intervals);
    const intervalCV = coefficientOfVariation(intervals);
    const dayConcentration = calculateDayConcentration(daysOfMonth);
    const amountMean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountRstd = coefficientOfVariation(amounts);
    const flags = extractFlags(sortedTxns[0].merchant, descriptions);
    
    // Pick sample transactions
    const samples = pickSampleTransactions(
      sortedTxns.map(t => ({
        date: dateToString(t.date),
        amount: Math.abs(Number(t.amount)),
        description: t.description || t.merchant
      }))
    );
    
    const summary = {
      merchant_key: merchantKey,
      original_name: sortedTxns[sortedTxns.length - 1].merchant, // Most recent name
      sample_transactions: samples,
      stats: {
        count: sortedTxns.length,
        median_interval_days: Math.round(medianInterval),
        interval_cv: Math.round(intervalCV * 100) / 100,
        day_concentration: dayConcentration,
        amount_mean: Math.round(amountMean * 100) / 100,
        amount_rstd: Math.round(amountRstd * 100) / 100,
        flags
      },
      first_date: dateToString(sortedTxns[0].date),
      last_date: dateToString(sortedTxns[sortedTxns.length - 1].date),
      unique_months: uniqueMonths.size
    };
    
    summaries.push(summary);
  }
  
  return summaries;
}

/**
 * Escape special characters in text to prevent JSON issues
 * Replaces quotes, backslashes, and newlines
 */
function escapeForPrompt(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/\n/g, ' ')     // Replace newlines with spaces
    .replace(/\r/g, '')      // Remove carriage returns
    .replace(/\t/g, ' ');    // Replace tabs with spaces
}

/**
 * Format merchant summary as compact text (for LLM prompt)
 * Target: ≤200 tokens
 */
export function formatMerchantSummaryForLLM(summary: MerchantSummary): string {
  const samples = summary.sample_transactions
    .map(s => {
      const cleanDesc = escapeForPrompt(s.description.substring(0, 50));
      return `  - ${s.date} debit $${s.amount.toFixed(2)} "${cleanDesc}"`;
    })
    .join('\n');

  const flags = summary.stats.flags.length > 0
    ? `  - flags: [${summary.stats.flags.map(f => `"${f}"`).join(', ')}]`
    : '';

  const cleanName = escapeForPrompt(summary.original_name);
  const cleanKey = escapeForPrompt(summary.merchant_key);

  return `PAYEE: "${cleanName}" (group key: ${cleanKey})
SAMPLES (${summary.sample_transactions.length}):
${samples}
STATS:
  - count: ${summary.stats.count} in ${summary.unique_months} months
  - median_interval: ${summary.stats.median_interval_days} days, interval_cv: ${summary.stats.interval_cv}
  - day concentration: ${summary.stats.day_concentration}
  - amount_mean: $${summary.stats.amount_mean.toFixed(2)}, amount_rstd: ${summary.stats.amount_rstd}${flags ? '\n' + flags : ''}`;
}

