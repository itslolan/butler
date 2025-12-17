import { MerchantSummary } from './merchant-summarizer';

export interface RuleScore {
  score: number; // 0-1
  components: {
    interval_regularity: number;
    day_concentration: number;
    amount_stability: number;
    keyword_bonus: number;
  };
}

/**
 * Score interval regularity based on coefficient of variation
 * Lower CV = more regular = higher score
 * 
 * CV < 0.15 (very regular) → 1.0
 * CV = 0.30 (moderately regular) → 0.5
 * CV > 0.60 (very irregular) → 0.0
 */
function scoreIntervalRegularity(intervalCV: number): number {
  if (intervalCV < 0.15) return 1.0;
  if (intervalCV > 0.60) return 0.0;
  
  // Linear interpolation between 0.15 and 0.60
  return 1.0 - ((intervalCV - 0.15) / (0.60 - 0.15));
}

/**
 * Score day-of-month concentration
 * Parses the day_concentration string and scores based on consistency
 * 
 * e.g., "8/10 within ±3 days of day 15" → ratio = 0.8 → score = 0.8
 */
function scoreDayConcentration(dayConcentration: string): number {
  // Parse pattern like "8/10 within ±3 days of day 15"
  const match = dayConcentration.match(/(\d+)\/(\d+)\s+within/);
  
  if (!match) return 0;
  
  const within = parseInt(match[1]);
  const total = parseInt(match[2]);
  
  if (total === 0) return 0;
  
  const ratio = within / total;
  
  // Need at least 60% concentration for any score
  if (ratio < 0.6) return 0;
  
  // Scale from 0.6-1.0 to 0.0-1.0
  return (ratio - 0.6) / 0.4;
}

/**
 * Score amount stability based on relative standard deviation
 * Lower rstd = more stable = higher score
 * 
 * rstd < 0.10 (very stable) → 1.0
 * rstd = 0.20 (moderately stable) → 0.5
 * rstd > 0.40 (very unstable) → 0.0
 */
function scoreAmountStability(amountRstd: number): number {
  if (amountRstd < 0.10) return 1.0;
  if (amountRstd > 0.40) return 0.0;
  
  // Linear interpolation between 0.10 and 0.40
  return 1.0 - ((amountRstd - 0.10) / (0.40 - 0.10));
}

/**
 * Calculate keyword bonus based on flags
 * Strong indicators of fixed expenses get higher bonuses
 */
function calculateKeywordBonus(flags: string[]): number {
  let bonus = 0;
  
  // Strong indicators (0.3 each, max one)
  if (flags.includes('loan_mortgage')) {
    bonus = Math.max(bonus, 0.3);
  }
  if (flags.includes('utility')) {
    bonus = Math.max(bonus, 0.3);
  }
  if (flags.includes('insurance')) {
    bonus = Math.max(bonus, 0.3);
  }
  
  // Medium indicators (0.2 each, max one)
  if (flags.includes('subscription')) {
    bonus = Math.max(bonus, 0.2);
  }
  if (flags.includes('ach_autopay')) {
    bonus = Math.max(bonus, 0.2);
  }
  
  // Weak indicators (0.1 each, max one)
  if (flags.includes('contains_bill_keyword')) {
    bonus = Math.max(bonus, 0.1);
  }
  if (flags.includes('has_account_number')) {
    bonus = Math.max(bonus, 0.1);
  }
  
  return Math.min(bonus, 0.3); // Cap at 0.3
}

/**
 * Check if median interval is close to monthly (28-32 days)
 * Returns a multiplier (0.0-1.0)
 */
function monthlyIntervalMultiplier(medianIntervalDays: number): number {
  // Perfect monthly cadence (28-32 days)
  if (medianIntervalDays >= 28 && medianIntervalDays <= 32) {
    return 1.0;
  }
  
  // Close to monthly (25-35 days)
  if (medianIntervalDays >= 25 && medianIntervalDays <= 35) {
    return 0.8;
  }
  
  // Bi-weekly (12-16 days)
  if (medianIntervalDays >= 12 && medianIntervalDays <= 16) {
    return 0.7;
  }
  
  // Quarterly (85-95 days)
  if (medianIntervalDays >= 85 && medianIntervalDays <= 95) {
    return 0.6;
  }
  
  // Weekly (6-8 days) - typically not fixed expenses
  if (medianIntervalDays >= 6 && medianIntervalDays <= 8) {
    return 0.2;
  }
  
  // Very frequent or very infrequent - likely not fixed
  return 0.3;
}

/**
 * Compute deterministic rule-based score for a merchant
 * Score is 0-1 where:
 * - 0.85+ = high confidence fixed expense
 * - 0.15- = high confidence not fixed
 * - 0.15-0.85 = ambiguous, needs LLM
 */
export function computeRuleScore(summary: MerchantSummary): RuleScore {
  // Component scores (0-1 each)
  const intervalRegularity = scoreIntervalRegularity(summary.stats.interval_cv);
  const dayConcentration = scoreDayConcentration(summary.stats.day_concentration);
  const amountStability = scoreAmountStability(summary.stats.amount_rstd);
  const keywordBonus = calculateKeywordBonus(summary.stats.flags);
  
  // Check if interval is close to common billing cycles
  const intervalMultiplier = monthlyIntervalMultiplier(summary.stats.median_interval_days);
  
  // Weighted combination:
  // - 35% interval regularity
  // - 25% day concentration
  // - 25% amount stability
  // - 15% keyword bonus
  const baseScore = 
    0.35 * intervalRegularity +
    0.25 * dayConcentration +
    0.25 * amountStability +
    0.15 * keywordBonus;
  
  // Apply interval multiplier
  const finalScore = baseScore * intervalMultiplier;
  
  return {
    score: Math.min(Math.max(finalScore, 0), 1), // Clamp to 0-1
    components: {
      interval_regularity: intervalRegularity,
      day_concentration: dayConcentration,
      amount_stability: amountStability,
      keyword_bonus: keywordBonus
    }
  };
}

/**
 * Determine if a merchant should be auto-accepted as fixed
 */
export function isHighConfidenceFixed(ruleScore: RuleScore): boolean {
  return ruleScore.score >= 0.85;
}

/**
 * Determine if a merchant should be auto-rejected as not fixed
 */
export function isHighConfidenceNotFixed(ruleScore: RuleScore): boolean {
  return ruleScore.score <= 0.15;
}

/**
 * Determine if a merchant is ambiguous and needs LLM judgment
 */
export function isAmbiguous(ruleScore: RuleScore): boolean {
  return ruleScore.score > 0.15 && ruleScore.score < 0.85;
}

