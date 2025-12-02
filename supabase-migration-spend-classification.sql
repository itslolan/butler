-- Migration: Add spend_classification column to transactions table
-- Stores whether each transaction is an Essential or Discretionary expense

-- Add the column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS spend_classification text CHECK (spend_classification IN ('essential', 'discretionary', NULL));

-- Add comment
COMMENT ON COLUMN transactions.spend_classification IS 'Classification of spending as essential (necessary) or discretionary (optional lifestyle)';

-- Update existing transactions based on common category patterns
-- Essentials
UPDATE transactions 
SET spend_classification = 'essential'
WHERE spend_classification IS NULL
AND LOWER(category) IN (
  'groceries', 'housing', 'rent', 'mortgage', 'utilities', 'gas/automotive', 
  'transportation', 'health/wellness', 'insurance', 'interest', 'loans', 
  'fees', 'healthcare', 'medical', 'pharmacy', 'gas', 'fuel', 'electric',
  'water', 'internet', 'phone', 'mobile'
);

-- Discretionary
UPDATE transactions 
SET spend_classification = 'discretionary'
WHERE spend_classification IS NULL
AND LOWER(category) IN (
  'food & dining', 'alcohol/bars', 'entertainment', 'shopping', 'travel',
  'electronics', 'electronics/software', 'software', 'home improvement',
  'subscription', 'streaming', 'dining', 'restaurants', 'bars', 'movies',
  'games', 'toys', 'clothing', 'fashion', 'hobbies'
);

-- Default remaining expenses to discretionary (can be manually adjusted later)
UPDATE transactions 
SET spend_classification = 'discretionary'
WHERE spend_classification IS NULL
AND transaction_type = 'expense';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_spend_classification 
ON transactions(spend_classification) 
WHERE spend_classification IS NOT NULL;

