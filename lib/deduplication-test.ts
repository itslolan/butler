import { searchTransactions } from './lib/db-tools';

/**
 * Deduplication Logic Test Utility
 * 
 * This helps understand and test the deduplication logic
 */

interface Transaction {
  date: string;
  merchant: string;
  amount: number;
  category?: string | null;
  description?: string | null;
}

/**
 * Simple JavaScript-based deduplication (fallback if Gemini fails)
 * Matches on: date, merchant (normalized), amount
 */
export function deduplicateTransactionsSimple(
  newTransactions: Transaction[],
  existingTransactions: Transaction[]
): {
  uniqueTransactions: Transaction[];
  duplicatesFound: number;
  duplicateExamples: string[];
} {
  console.log('\n=== DEDUPLICATION TEST ===');
  console.log(`New transactions: ${newTransactions.length}`);
  console.log(`Existing transactions: ${existingTransactions.length}`);

  const uniqueTransactions: Transaction[] = [];
  const duplicateExamples: string[] = [];

  for (const newTxn of newTransactions) {
    let isDuplicate = false;

    for (const existingTxn of existingTransactions) {
      // Normalize dates for comparison (handle different formats)
      const newDate = new Date(newTxn.date).toISOString().split('T')[0];
      const existingDate = new Date(existingTxn.date).toISOString().split('T')[0];

      // Normalize merchant names (lowercase, remove extra spaces)
      const newMerchant = newTxn.merchant.toLowerCase().trim().replace(/\s+/g, ' ');
      const existingMerchant = existingTxn.merchant.toLowerCase().trim().replace(/\s+/g, ' ');

      // Check if amounts match (handle floating point precision)
      const amountsMatch = Math.abs(newTxn.amount - existingTxn.amount) < 0.01;

      if (newDate === existingDate && newMerchant === existingMerchant && amountsMatch) {
        isDuplicate = true;
        const example = `${newDate} | ${newTxn.merchant} | $${newTxn.amount.toFixed(2)} - exact match`;
        
        console.log(`  ❌ DUPLICATE: ${example}`);
        
        if (duplicateExamples.length < 5) {
          duplicateExamples.push(example);
        }
        break;
      }
    }

    if (!isDuplicate) {
      console.log(`  ✅ UNIQUE: ${newTxn.date} | ${newTxn.merchant} | $${newTxn.amount.toFixed(2)}`);
      uniqueTransactions.push(newTxn);
    }
  }

  const duplicatesFound = newTransactions.length - uniqueTransactions.length;

  console.log(`\nRESULT: ${duplicatesFound} duplicates, ${uniqueTransactions.length} unique`);
  console.log('=== END DEDUPLICATION ===\n');

  return {
    uniqueTransactions,
    duplicatesFound,
    duplicateExamples,
  };
}

/**
 * Test Cases
 */
export function runDeduplicationTests() {
  console.log('\n🧪 Running Deduplication Tests...\n');

  // Test 1: Exact duplicates
  console.log('TEST 1: Exact Duplicates');
  const test1New = [
    { date: '2025-08-15', merchant: 'Starbucks', amount: 5.50 },
    { date: '2025-08-20', merchant: 'Amazon', amount: 89.99 },
  ];
  const test1Existing = [
    { date: '2025-08-15', merchant: 'Starbucks', amount: 5.50 },
    { date: '2025-08-20', merchant: 'Amazon', amount: 89.99 },
  ];
  const result1 = deduplicateTransactionsSimple(test1New, test1Existing);
  console.assert(result1.uniqueTransactions.length === 0, 'Should find 0 unique (all duplicates)');
  console.assert(result1.duplicatesFound === 2, 'Should find 2 duplicates');

  // Test 2: No duplicates
  console.log('\nTEST 2: No Duplicates');
  const test2New = [
    { date: '2025-08-15', merchant: 'Starbucks', amount: 5.50 },
    { date: '2025-08-20', merchant: 'Amazon', amount: 89.99 },
  ];
  const test2Existing = [
    { date: '2025-08-10', merchant: 'McDonalds', amount: 12.00 },
  ];
  const result2 = deduplicateTransactionsSimple(test2New, test2Existing);
  console.assert(result2.uniqueTransactions.length === 2, 'Should find 2 unique');
  console.assert(result2.duplicatesFound === 0, 'Should find 0 duplicates');

  // Test 3: Merchant name variations
  console.log('\nTEST 3: Merchant Name Variations');
  const test3New = [
    { date: '2025-08-15', merchant: 'STARBUCKS #1234', amount: 5.50 },
  ];
  const test3Existing = [
    { date: '2025-08-15', merchant: 'starbucks #1234', amount: 5.50 },
  ];
  const result3 = deduplicateTransactionsSimple(test3New, test3Existing);
  console.assert(result3.uniqueTransactions.length === 0, 'Should match case-insensitive');
  console.assert(result3.duplicatesFound === 1, 'Should find 1 duplicate');

  // Test 4: Same merchant, different amounts
  console.log('\nTEST 4: Same Merchant, Different Amounts');
  const test4New = [
    { date: '2025-08-15', merchant: 'Starbucks', amount: 5.50 },
    { date: '2025-08-15', merchant: 'Starbucks', amount: 8.75 },
  ];
  const test4Existing = [
    { date: '2025-08-15', merchant: 'Starbucks', amount: 5.50 },
  ];
  const result4 = deduplicateTransactionsSimple(test4New, test4Existing);
  console.assert(result4.uniqueTransactions.length === 1, 'Should keep different amount');
  console.assert(result4.duplicatesFound === 1, 'Should find 1 duplicate');

  // Test 5: Same merchant & amount, different dates
  console.log('\nTEST 5: Same Merchant & Amount, Different Dates');
  const test5New = [
    { date: '2025-08-15', merchant: 'Starbucks', amount: 5.50 },
    { date: '2025-08-16', merchant: 'Starbucks', amount: 5.50 },
  ];
  const test5Existing = [
    { date: '2025-08-15', merchant: 'Starbucks', amount: 5.50 },
  ];
  const result5 = deduplicateTransactionsSimple(test5New, test5Existing);
  console.assert(result5.uniqueTransactions.length === 1, 'Should keep different date');
  console.assert(result5.duplicatesFound === 1, 'Should find 1 duplicate');

  console.log('\n✅ All tests completed!\n');
}

// Export for use in API
export { Transaction };

