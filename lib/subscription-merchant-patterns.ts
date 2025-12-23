export interface SubscriptionPattern {
  name: string;
  patterns: Array<string | RegExp>;
}

/**
 * Curated list of popular subscription services in US/Canada + common billing descriptors.
 * This is used for *non-AI* candidate detection when history is short (<3 months).
 *
 * Notes:
 * - Matching is done against merchant + description (lowercased).
 * - Keep patterns fairly broad but not overly generic.
 */
export const SUBSCRIPTION_PATTERNS: SubscriptionPattern[] = [
  {
    name: 'YouTube',
    patterns: [/youtube(\s*premium|\s*music)?/i, /google\s*youtube/i],
  },
  {
    name: 'Netflix',
    patterns: [/netflix/i],
  },
  {
    name: 'Spotify',
    patterns: [/spotify/i],
  },
  {
    name: 'Apple Services',
    patterns: [/apple\.com\/bill/i, /\bapple\s*(one|music|tv|icloud)\b/i, /\bitunes\b/i, /\bapp\s*store\b/i],
  },
  {
    name: 'Google Services',
    patterns: [/\bgoogle\s*one\b/i, /\bgoogle\s*play\b/i, /google\s*storage/i, /g\.co\/helppay/i],
  },
  {
    name: 'Amazon Prime',
    patterns: [/amazon\s*prime/i, /\bprime\s*video\b/i],
  },
  {
    name: 'Disney+',
    patterns: [/disney\+|disney\s*plus/i],
  },
  {
    name: 'Hulu',
    patterns: [/\bhulu\b/i],
  },
  {
    name: 'Max (HBO)',
    patterns: [/\bhbo\b/i, /\bmax\b/i],
  },
  {
    name: 'Paramount+',
    patterns: [/paramount\+|paramount\s*plus/i],
  },
  {
    name: 'Peacock',
    patterns: [/peacock/i],
  },
  {
    name: 'Microsoft',
    patterns: [/microsoft\s*365/i, /\boffice\s*365\b/i, /xbox\s*game\s*pass/i, /\bxbox\b/i],
  },
  {
    name: 'Adobe',
    patterns: [/adobe/i, /creative\s*cloud/i],
  },
  {
    name: 'Dropbox',
    patterns: [/dropbox/i],
  },
  {
    name: 'iCloud',
    patterns: [/\bicloud\b/i],
  },
  {
    name: 'Zoom',
    patterns: [/\bzoom\b/i],
  },
  {
    name: 'GitHub',
    patterns: [/\bgithub\b/i],
  },
  {
    name: 'Patreon',
    patterns: [/\bpatreon\b/i],
  },
  {
    name: 'NYTimes',
    patterns: [/new\s*york\s*times|nytimes/i],
  },
  {
    name: 'PrimeVideoChannels',
    patterns: [/channel\s*subscription/i],
  },
  // Generic billing descriptors (helps catch “APPLE.COM/BILL”, “GOOGLE*SERVICE”, etc.)
  {
    name: 'GenericSubscriptionDescriptors',
    patterns: [/\bsubscription\b/i, /\bmonthly\b/i, /\bannual\b/i, /\brecurring\b/i, /\bmembership\b/i],
  },
];

export function matchSubscriptionPattern(text: string): string | null {
  for (const entry of SUBSCRIPTION_PATTERNS) {
    for (const p of entry.patterns) {
      if (typeof p === 'string') {
        if (text.includes(p.toLowerCase())) return entry.name;
      } else if (p.test(text)) {
        return entry.name;
      }
    }
  }
  return null;
}

