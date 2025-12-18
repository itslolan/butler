'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSubscriptionIcon, getSubscriptionColor, GenericSubscriptionIcon } from './subscription-icons';

interface Subscription {
  merchant_name: string;
  median_amount: number;
  occurrence_count: number;
  months_tracked: number;
  avg_day_of_month: number;
  last_occurrence_date: string;
  is_maybe?: boolean;
  merchant_key?: string;
}

interface FixedExpensesData {
  total: number;
  expenses: Subscription[];
  calculated_at: string;
  from_cache: boolean;
}

interface SubscriptionsPanelProps {
  userId?: string;
  refreshTrigger?: number;
  currency?: string;
  demoData?: FixedExpensesData | null;
}

// Keywords that identify subscription services (vs utilities, rent, etc.)
const SUBSCRIPTION_KEYWORDS = [
  // Streaming
  'netflix', 'hulu', 'disney', 'hbo', 'max', 'paramount', 'peacock', 'apple tv',
  'amazon prime', 'prime video', 'spotify', 'apple music', 'youtube', 'tidal',
  'audible', 'kindle', 'crunchyroll', 'funimation',
  // Software/Productivity
  'adobe', 'creative cloud', 'microsoft 365', 'office 365', 'google one',
  'dropbox', 'icloud', 'notion', 'evernote', 'todoist', 'asana', 'trello',
  'slack', 'zoom', 'canva', 'figma', 'github', 'gitlab',
  // Security
  'nordvpn', 'expressvpn', 'surfshark', 'vpn', '1password', 'lastpass',
  'dashlane', 'bitwarden', 'norton', 'mcafee', 'avast',
  // Health/Fitness
  'planet fitness', 'la fitness', 'gold gym', 'peloton', 'strava',
  'headspace', 'calm', 'noom', 'weight watchers', 'myfitnesspal',
  'duolingo', 'babbel', 'rosetta',
  // Gaming
  'xbox', 'playstation', 'nintendo', 'steam', 'ea play', 'ubisoft',
  'game pass', 'ps plus', 'psn',
  // AI Services
  'chatgpt', 'openai', 'claude', 'anthropic', 'midjourney', 'copilot',
  // Finance/Budgeting
  'ynab', 'mint', 'personal capital', 'quicken',
  // News/Media
  'new york times', 'washington post', 'wall street', 'wsj', 'medium',
  'substack', 'patreon',
  // Cloud Storage
  'backblaze', 'carbonite', 'crashplan',
  // Other subscriptions
  'apple', 'itunes', 'app store', 'google play',
  'membership', 'subscription', 'premium', 'plus', 'pro',
];

// Keywords that indicate NOT a subscription (utilities, bills, etc.)
const NON_SUBSCRIPTION_KEYWORDS = [
  'electric', 'gas', 'water', 'sewer', 'trash', 'utility', 'utilities',
  'rent', 'mortgage', 'insurance', 'loan', 'payment',
  'phone', 'mobile', 'cellular', 'verizon', 'at&t', 'att', 't-mobile', 'tmobile',
  'internet', 'cable', 'comcast', 'xfinity', 'spectrum', 'cox',
  'car', 'auto', 'vehicle',
];

/**
 * Determines if a fixed expense is likely a subscription service
 */
function isSubscription(merchantName: string): boolean {
  const normalizedName = merchantName.toLowerCase();
  
  // First check if it's explicitly NOT a subscription
  for (const keyword of NON_SUBSCRIPTION_KEYWORDS) {
    if (normalizedName.includes(keyword)) {
      return false;
    }
  }
  
  // Then check if it matches subscription keywords
  for (const keyword of SUBSCRIPTION_KEYWORDS) {
    if (normalizedName.includes(keyword)) {
      return true;
    }
  }
  
  // Default to false - we only want to show things we're confident are subscriptions
  return false;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCurrencyCompact(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const CACHE_KEY = 'subscriptions-panel-cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData {
  data: FixedExpensesData;
  timestamp: number;
  userId: string;
}

export default function SubscriptionsPanel({
  userId = 'default-user',
  refreshTrigger = 0,
  currency = 'USD',
  demoData = null,
}: SubscriptionsPanelProps) {
  const [data, setData] = useState<FixedExpensesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from cache
  const loadFromCache = useCallback((): FixedExpensesData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const parsedCache: CachedData = JSON.parse(cached);
      
      if (parsedCache.userId !== userId) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      const now = Date.now();
      if (now - parsedCache.timestamp > CACHE_DURATION_MS) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return parsedCache.data;
    } catch (err) {
      console.error('Error loading from cache:', err);
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, [userId]);

  // Save to cache
  const saveToCache = useCallback((data: FixedExpensesData) => {
    try {
      const cacheData: CachedData = {
        data,
        timestamp: Date.now(),
        userId,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.error('Error saving to cache:', err);
    }
  }, [userId]);

  // Fetch from API
  const fetchData = useCallback(async (skipCache = false) => {
    setLoading(true);
    setError(null);

    try {
      if (!skipCache) {
        const cachedData = loadFromCache();
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return;
        }
      }

      const response = await fetch('/api/fixed-expenses');
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Failed to fetch subscriptions';
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            // Couldn't parse JSON error, use default message
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setData(result);
      saveToCache(result);
    } catch (err: any) {
      console.error('Error fetching subscriptions:', err);
      setError(err.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [loadFromCache, saveToCache]);

  useEffect(() => {
    if (demoData) {
      setData(demoData);
      setLoading(false);
      return;
    }

    // Don't fetch if userId is default-user (not authenticated)
    if (userId === 'default-user') {
      setLoading(false);
      setError('Please log in to view subscriptions');
      return;
    }

    fetchData(refreshTrigger > 0);
  }, [refreshTrigger, fetchData, demoData, userId]);

  // Filter to only show subscriptions
  const subscriptions = data?.expenses?.filter(exp => isSubscription(exp.merchant_name)) || [];
  const totalSubscriptions = subscriptions.reduce((sum, sub) => sum + sub.median_amount, 0);
  const yearlyTotal = totalSubscriptions * 12;

  // Loading state
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <button 
          onClick={() => fetchData(false)} 
          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // No subscriptions detected
  if (subscriptions.length === 0) {
    return null; // Don't show panel if no subscriptions found
  }

  // Calculate sizes for treemap-style layout
  // Larger subscriptions get more visual weight
  const maxAmount = Math.max(...subscriptions.map(s => s.median_amount));
  const getBoxSize = (amount: number): string => {
    const ratio = amount / maxAmount;
    if (ratio > 0.7) return 'col-span-2 row-span-2'; // Large
    if (ratio > 0.4) return 'col-span-2 row-span-1'; // Medium-wide
    if (ratio > 0.25) return 'col-span-1 row-span-2'; // Medium-tall
    return 'col-span-1 row-span-1'; // Small
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📱</span>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Subscriptions
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {subscriptions.length} active
            </span>
          </div>
        </div>
      </div>

      {/* Treemap Grid */}
      <div className="p-4">
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 auto-rows-[80px] gap-2">
          {subscriptions
            .sort((a, b) => b.median_amount - a.median_amount) // Sort by amount descending
            .map((subscription, index) => {
              const Icon = getSubscriptionIcon(subscription.merchant_name);
              const colorScheme = getSubscriptionColor(index);
              const boxSize = getBoxSize(subscription.median_amount);
              const percentage = ((subscription.median_amount / totalSubscriptions) * 100).toFixed(0);
              const isLarge = boxSize.includes('row-span-2');
              const yearlyAmount = subscription.median_amount * 12;

              return (
                <div
                  key={`${subscription.merchant_name}-${index}`}
                  className={`${boxSize} ${colorScheme.bg} rounded-xl p-3 flex flex-col justify-between relative overflow-hidden transition-transform hover:scale-[1.02] cursor-default`}
                >
                  {/* Percentage badge */}
                  <div className="absolute top-2 right-2">
                    <span className={`text-[10px] font-medium ${colorScheme.text} opacity-70`}>
                      {percentage}%
                    </span>
                  </div>

                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {Icon ? (
                      <Icon 
                        className={`${colorScheme.text} opacity-80`} 
                        size={isLarge ? 28 : 20} 
                      />
                    ) : null}
                  </div>

                  {/* Content */}
                  <div className="mt-auto">
                    <p className={`text-xs font-medium ${colorScheme.text} truncate leading-tight`}>
                      {subscription.merchant_name}
                    </p>
                    <p className={`text-lg font-bold ${colorScheme.text} leading-tight`}>
                      {formatCurrency(subscription.median_amount, currency)}
                    </p>
                    {isLarge && (
                      <p className={`text-[10px] ${colorScheme.text} opacity-60`}>
                        ~{formatCurrencyCompact(yearlyAmount, currency)}/yr
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Footer with totals */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">
              Total / Month
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(totalSubscriptions, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">
              Yearly Projection
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(yearlyTotal, currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
